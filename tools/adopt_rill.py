"""Inspect and install a reviewed Rill Copier release without replacing existing native settings."""

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def checked_git(*arguments, cwd):
    result = subprocess.run(  # noqa: S603 - argv array, never shell
        [shutil.which("git") or "git", *arguments],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def ownership(target):
    native_roles = target / ".codex/agents"
    skill_dir = target / ".agents/skills"
    return {
        "preserve_agent_entry": (target / "AGENTS.md").is_file(),
        "preserve_codex_roles": (target / ".codex/config.toml").is_file()
        or (native_roles.is_dir() and any(native_roles.glob("*.toml"))),
        "preserve_hook_config": (target / ".codex/hooks.json").is_file()
        or (target / ".codex/hooks/rill.py").is_file(),
        "preserve_rill_skills": skill_dir.is_dir() and any(skill_dir.glob("rill-*/SKILL.md")),
    }


def preflight(target):
    if target.exists() and not target.is_dir():
        raise ValueError("Target must be a directory")
    if not target.exists():
        raise ValueError("Create an empty target directory before first adoption")
    root = checked_git("rev-parse", "--show-toplevel", cwd=target)
    if root:
        if Path(root).resolve() != target:
            raise ValueError("Target must be the product repository root")
        dirty = checked_git(
            "-c",
            "status.showUntrackedFiles=all",
            "status",
            "--porcelain",
            "--untracked-files=all",
            cwd=target,
        )
        if dirty is None:
            raise ValueError("Cannot verify the target Git worktree")
        if dirty:
            raise ValueError("Target Git worktree is not clean; preserve unrelated work")
    elif any(target.iterdir()):
        raise ValueError("Existing non-empty target must have a Git repository")
    return ownership(target)


def main():
    parser = argparse.ArgumentParser(
        description="Detect native ownership and install a reviewed Copier source"
    )
    parser.add_argument("target", type=Path)
    parser.add_argument("--source", required=True, help="Reviewed Rill Git source")
    parser.add_argument("--ref", required=True, help="Reviewed pinned Git tag")
    parser.add_argument("--data", action="append", default=[], metavar="NAME=VALUE")
    parser.add_argument("--apply", action="store_true", help="Actually run native Copier")
    args = parser.parse_args()
    target = args.target.resolve()
    # Native Copier changes its cwd via mise -C. Normalize local sources
    # before that transition, while leaving Git remotes and HTTPS URLs intact.
    remote_prefixes = ("https://", "http://", "ssh://", "git@", "gh:")
    source = (
        args.source
        if args.source.startswith(remote_prefixes)
        else str(Path(args.source).expanduser().resolve())
    )
    try:
        flags = preflight(target)
        values = {}
        for pair in args.data:
            key, delimiter, value = pair.partition("=")
            if not delimiter or not key or key.startswith("preserve_"):
                raise ValueError("Invalid or reserved Copier --data argument: " + pair)
            values[key] = value
    except (OSError, ValueError) as error:
        parser.exit(2, "Rill adoption BLOCKED: " + str(error) + "\n")
    receipt = {
        "target": str(target),
        "source": source,
        "revision": args.ref,
        "existing_native_ownership": flags,
        "status": "READY_TO_APPLY" if not args.apply else "APPLYING",
    }
    print(json.dumps(receipt, sort_keys=True), flush=True)
    if not args.apply:
        return
    source_root = Path(__file__).resolve().parents[1]
    cmd = [
        "mise",
        "-C",
        str(source_root),
        "exec",
        "--locked",
        "pypi:copier",
        "--",
        "copier",
        "copy",
        "--defaults",
        "--vcs-ref",
        args.ref,
    ]
    for key, value in {**flags, **values}.items():
        cmd.extend(
            (
                "--data",
                f"{key}={str(value).lower() if isinstance(value, bool) else value}",
            )
        )
    cmd.extend((source, str(target)))
    result = subprocess.run(  # noqa: S603 - fixed Mise CLI, argv array
        [shutil.which("mise") or "mise", *cmd[1:]],
        check=False,
    )
    if result.returncode:
        raise SystemExit(result.returncode)
    print(
        json.dumps(
            {
                "status": "COPIED_NOT_VERIFIED",
                "target": str(target),
                "next": (
                    "Review generated native files, verify models/Hooks/Skills and run product CI"
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
