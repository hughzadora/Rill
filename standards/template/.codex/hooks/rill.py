"""Native Codex hook adapter. GitHub/Git own state; this script owns none."""

import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path


def command(*args, cwd=None, timeout=4):
    try:
        result = subprocess.run(
            args,
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
    if not (root / ".rill/STANDARD.md").is_file():
        result["reason"] = "Missing installed Rill standard"
        return result
    expected_roles = ("default", "explorer", "reviewer", "risk_reviewer", "worker")
    for required in (
        ".codex/config.toml",
        ".codex/hooks.json",
        ".codex/hooks/rill.py",
        "AGENTS.md",
        *(
            f".agents/skills/rill-{name}/SKILL.md"
            for name in ("adopt", "deliver", "review", "recover")
        ),
    ):
        if not (root / required).is_file():
            result["reason"] = "Incomplete Rill capability distribution: " + required
            return result
    try:
        config = tomllib.loads(
            (root / ".codex/config.toml").read_text(encoding="utf-8")
        )
        hooks = json.loads((root / ".codex/hooks.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError, TypeError):
        result["reason"] = "Invalid native Codex config or Hook declarations"
        return result
    if not isinstance(config, dict) or not isinstance(hooks, dict):
        result["reason"] = "Invalid native Codex config or Hook declarations"
        return result
    native = config.get("agents", {})
    if not isinstance(native, dict):
        result["reason"] = "Invalid native Codex agent declarations"
        return result
    if native.get("enabled") is not True or not isinstance(hooks.get("hooks"), dict):
        result["reason"] = "Native Codex agents or Hooks are unavailable"
        return result
    for role in expected_roles:
        declaration = native.get(role, {})
        if not isinstance(declaration, dict):
            result["reason"] = "Invalid native role declaration: " + role
            return result
        relative = declaration.get("config_file")
        if relative != f"./agents/{role.replace('_', '-')}.toml":
            result["reason"] = "Missing native role declaration: " + role
            return result
        role_path = root / ".codex/agents" / f"{role.replace('_', '-')}.toml"
        try:
            role_config = tomllib.loads(role_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ValueError, TypeError):
            result["reason"] = "Invalid native role file: " + role
            return result
        for field in ("model", "model_reasoning_effort", "developer_instructions"):
            if (
                not isinstance(role_config.get(field), str)
                or not role_config[field].strip()
            ):
                result["reason"] = f"Native role {role} lacks {field}"
                return result
        if role_config.get("name") != role:
            result["reason"] = "Incorrect native role identity: " + role
            return result
    expected_actions = {
        "SessionStart": "start",
        "SubagentStart": "subagent",
        "PostToolUse": "check",
        "Stop": "stop",
    }
    for event, action in expected_actions.items():
        groups = hooks["hooks"].get(event)
        if not isinstance(groups, list) or not groups:
            result["reason"] = "Missing native Hook event: " + event
            return result
        expected_command = (
            'python3 "$(git rev-parse --show-toplevel)/.codex/hooks/rill.py" ' + action
        )
        if not any(
            isinstance(group, dict)
            and isinstance(group.get("hooks"), list)
            and any(
                isinstance(handler, dict)
                and handler.get("type") == "command"
                and isinstance(handler.get("command"), str)
                and handler["command"] == expected_command
                for handler in group["hooks"]
            )
            for group in groups
        ):
            result["reason"] = "Missing Rill command handler: " + event
            return result
    try:
        entry = (root / "AGENTS.md").read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        result["reason"] = "Cannot read native AGENTS.md"
        return result
    if "Rill Agent Entry" not in entry:
        result["reason"] = "Existing AGENTS.md requires reviewed Rill integration"
        return result
    if not parent:
        result["reason"] = "Target project has no configured engineering parent Issue"
        return result
    origin = command("git", "-C", str(root), "remote", "get-url", "origin")
    if not origin:
        result["reason"] = "Cannot verify the checkout's Git origin"
        return result
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
        result["reason"] = "Cannot verify target GitHub repository"
        return result
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
        result["reason"] = "Cannot verify bound GitHub parent Issue"
        return result
    try:
        issue = json.loads(raw)
    except json.JSONDecodeError:
        result["reason"] = "Invalid GitHub Issue response"
        return result
    if issue.get("number") != parent or issue.get("state") != "OPEN":
        result["reason"] = "Parent Issue does not identify active work"
        return result
    result["status"] = "BOUND"
    result["reason"] = "Verified native GitHub issue"
    result["repository"] = repository
    result["issue"] = {
        "number": parent,
        "title": issue.get("title"),
        "url": issue.get("url"),
    }
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
            result = subprocess.run(
                ["git", "-C", str(root), *diff_args],
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
                            "git diff --check failed; fix whitespace issues. "
                            + errors[:500]
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
    if len(sys.argv) != 2 or sys.argv[1] not in (
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
