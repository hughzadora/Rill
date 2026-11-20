"""Native Codex hook adapter. GitHub/Git own state; this script owns none."""

import json
import os
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path


def command(*args, cwd=None, timeout=4):
    try:
        result = subprocess.run(  # noqa: S603 - argv array; no shell execution
            (shutil.which(args[0]) or args[0], *args[1:]),
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def root_for(cwd):
    root = command("git", "-C", str(cwd), "rev-parse", "--show-toplevel")
    return Path(root) if root else None


def parent_issue(root):
    answers = root / ".rill/copier-answers.yml"
    try:
        content = answers.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"^github_parent_issue:\s*(\d+)\s*$", content, re.MULTILINE)
    return int(match.group(1)) if match else None


def distribution_status(root):
    if not (root / ".rill/STANDARD.md").is_file():
        return "Missing installed Rill standard"
    required = (
        ".codex/config.toml",
        ".codex/hooks.json",
        ".codex/hooks/rill.py",
        "AGENTS.md",
        *(
            f".agents/skills/rill-{name}/SKILL.md"
            for name in ("adopt", "deliver", "review", "recover")
        ),
    )
    for relative in required:
        if not (root / relative).is_file():
            return "Incomplete Rill capability distribution: " + relative
    return None


def role_status(root, native):
    expected = ("default", "explorer", "reviewer", "risk_reviewer", "worker")
    for role in expected:
        declaration = native.get(role, {})
        if not isinstance(declaration, dict):
            return "Invalid native role declaration: " + role
        stem = role.replace("_", "-")
        if declaration.get("config_file") != f"./agents/{stem}.toml":
            return "Missing native role declaration: " + role
        try:
            role_config = tomllib.loads(
                (root / ".codex/agents" / f"{stem}.toml").read_text(encoding="utf-8")
            )
        except (OSError, UnicodeError, ValueError, TypeError):
            return "Invalid native role file: " + role
        for field in ("model", "model_reasoning_effort", "developer_instructions"):
            if not isinstance(role_config.get(field), str) or not role_config[field].strip():
                return f"Native role {role} lacks {field}"
        if role_config.get("name") != role:
            return "Incorrect native role identity: " + role
    return None


def hook_status(groups):
    expected_actions = {
        "SessionStart": "start",
        "SubagentStart": "subagent",
        "PostToolUse": "check",
        "Stop": "stop",
    }
    for event, action in expected_actions.items():
        entries = groups.get(event)
        if not isinstance(entries, list) or not entries:
            return "Missing native Hook event: " + event
        expected_command = (
            'python3 "$(git rev-parse --show-toplevel)/.codex/hooks/rill.py" ' + action
        )
        if not any(
            isinstance(entry, dict)
            and isinstance(entry.get("hooks"), list)
            and any(
                isinstance(handler, dict)
                and handler.get("type") == "command"
                and handler.get("command") == expected_command
                for handler in entry["hooks"]
            )
            for entry in entries
        ):
            return "Missing Rill command handler: " + event
    return None


def native_status(root):
    try:
        config = tomllib.loads((root / ".codex/config.toml").read_text(encoding="utf-8"))
        hooks = json.loads((root / ".codex/hooks.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError, TypeError):
        return "Invalid native Codex config or Hook declarations"
    if not isinstance(config, dict) or not isinstance(hooks, dict):
        return "Invalid native Codex config or Hook declarations"
    native = config.get("agents", {})
    if not isinstance(native, dict):
        return "Invalid native Codex agent declarations"
    if native.get("enabled") is not True or not isinstance(hooks.get("hooks"), dict):
        return "Native Codex agents or Hooks are unavailable"
    return role_status(root, native) or hook_status(hooks["hooks"])


def entry_status(root):
    try:
        entry = (root / "AGENTS.md").read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return "Cannot read native AGENTS.md"
    if "Rill Agent Entry" not in entry:
        return "Existing AGENTS.md requires reviewed Rill integration"
    return None


def github_binding(root, parent):
    origin = command("git", "-C", str(root), "remote", "get-url", "origin")
    if not origin:
        return None, "Cannot verify the checkout's Git origin"
    repository = command(
        "gh",
        "repo",
        "view",
        origin,
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner",
        cwd=root,
    )
    if not repository:
        return None, "Cannot verify target GitHub repository"
    raw = command(
        "gh",
        "issue",
        "view",
        str(parent),
        "-R",
        repository,
        "--json",
        "number,title,state,url",
        cwd=root,
    )
    if not raw:
        return None, "Cannot verify bound GitHub parent Issue"
    try:
        issue = json.loads(raw)
    except json.JSONDecodeError:
        return None, "Invalid GitHub Issue response"
    if not isinstance(issue, dict) or issue.get("number") != parent or issue.get("state") != "OPEN":
        return None, "Parent Issue does not identify active work"
    return {
        "repository": repository,
        "issue": {
            "number": parent,
            "title": issue.get("title"),
            "url": issue.get("url"),
        },
    }, None


def snapshot(cwd):
    root = root_for(cwd)
    if root is None:
        return {"status": "BLOCKED", "reason": "Not in a Git checkout"}
    head = command("git", "-C", str(root), "rev-parse", "HEAD")
    dirty = command("git", "-C", str(root), "status", "--porcelain")
    parent = parent_issue(root)
    result = {
        "repo_root": str(root),
        "head": head,
        "dirty": bool(dirty) if dirty is not None else None,
        "parent_issue": parent,
        "status": "BLOCKED",
        "reason": "Unverified issue binding",
    }
    if head is None or dirty is None:
        result["reason"] = "Git revision or worktree status could not be verified"
        return result
    failure = distribution_status(root) or native_status(root) or entry_status(root)
    if failure:
        result["reason"] = failure
        return result
    if not parent:
        result["reason"] = "Target project has no configured engineering parent Issue"
        return result
    binding, error = github_binding(root, parent)
    if error:
        result["reason"] = error
        return result
    result.update(binding)
    result.update(status="BOUND", reason="Verified native GitHub issue")
    return result


def read_event():
    try:
        value = json.load(sys.stdin)
        return value if isinstance(value, dict) else {}
    except (ValueError, OSError):
        return {}


def start(event):
    state = snapshot(event.get("cwd") or os.getcwd())
    # Never claim a task was selected from the parent alone.
    summary = (
        "Rill installed runtime: "
        + state["status"]
        + "; git HEAD "
        + str(state.get("head"))
        + "; "
        + str(state.get("reason"))
        + ". Read .rill/STANDARD.md and native product GitHub issues/PRs. "
        "Discover the actual ready child and blocked dependencies before acting; "
        "no previous transcript is authoritative. "
        "Models/roles are declarations until native execution is observed."
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": summary[:1100],
                }
            }
        )
    )


def subagent(event):
    role = event.get("agent_type") or "unknown"
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SubagentStart",
                    "additionalContext": (
                        "Rill assigned native role "
                        + str(role)
                        + ". Read the assigned product Issue, exact SHA and scope. "
                        "Return real checks and blockers; do not self-approve."
                    )[:550],
                }
            }
        )
    )


def whitespace_check(root):
    findings = []
    for diff_args in (("diff", "--check"), ("diff", "--cached", "--check")):
        try:
            result = subprocess.run(  # noqa: S603 - fixed Git binary and flags
                [shutil.which("git") or "git", "-C", str(root), *diff_args],
                capture_output=True,
                text=True,
                timeout=4,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        if result.returncode:
            # Operational Git errors are not whitespace findings and cannot
            # safely trigger automated correction prompts.
            message = result.stdout.strip()
            if result.stderr.strip() or not any(
                warning in message
                for warning in (
                    "trailing whitespace",
                    "new blank line",
                    "space before tab",
                )
            ):
                return None
            findings.append(message)
    return "\n".join(findings)


def check(event):
    root = root_for(event.get("cwd") or os.getcwd())
    if root is None:
        print("{}")
        return
    errors = whitespace_check(root)
    if errors is None:
        print(json.dumps({"systemMessage": "Rill changed-source check unavailable"}))
        return
    if errors:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PostToolUse",
                        "additionalContext": (
                            "git diff --check failed; fix whitespace issues. " + errors[:500]
                        ),
                    }
                }
            )
        )
    else:
        print("{}")


def stop(event):
    # Deterministic single extra pass only. Never infer business completion
    # from a language model assertion or invent a retry state database.
    if event.get("stop_hook_active"):
        print("{}")
        return
    root = root_for(event.get("cwd") or os.getcwd())
    if root is None:
        print("{}")
        return
    errors = whitespace_check(root)
    if errors is None:
        print(json.dumps({"systemMessage": "Rill changed-source check unavailable"}))
        return
    if errors:
        print(
            json.dumps(
                {
                    "decision": "block",
                    "reason": (
                        "The current product diff/index has deterministic whitespace "
                        "errors. Fix git diff --check and git diff --cached --check, "
                        "rerun targeted checks, then report remaining blockers. "
                        "Do not merge or deploy."
                    ),
                }
            )
        )
    else:
        print("{}")


def main():
    if len(sys.argv) != len(("script", "mode")) or sys.argv[1] not in (
        "status",
        "start",
        "subagent",
        "check",
        "stop",
    ):
        raise SystemExit("usage: rill.py status|start|subagent|check|stop")
    if sys.argv[1] == "status":
        print(json.dumps(snapshot(os.getcwd()), indent=2, sort_keys=True))
        return
    event = read_event()
    {
        "start": start,
        "subagent": subagent,
        "check": check,
        "stop": stop,
    }[sys.argv[1]](event)


if __name__ == "__main__":
    main()
