"""Offline dashboard and one-shot loopback owner acknowledgement endpoint."""

import json
import secrets
import webbrowser
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import cast
from urllib.parse import urlsplit

from rill_cli.assets import dashboard as dashboard_asset

from .constants import (
    ALLOWED_DECISIONS,
    CI_SUMMARY_PATH,
    DASHBOARD_PATH,
    MAX_POST_BYTES,
    MAX_SYMBOL_LINES,
    SYMBOLS_PATH,
    UI_HOST,
    UI_PORT,
    UI_TOKEN_BYTES,
)
from .git_policy import branch, business_changes, head_summary, history
from .state import load, save, write_json


def facts(root: Path) -> dict[str, object]:
    state = load(root)
    path = root / SYMBOLS_PATH
    ci_file = root / CI_SUMMARY_PATH
    symbols = (
        "\n".join(path.read_text(encoding="utf-8").splitlines()[:MAX_SYMBOL_LINES])
        if path.exists()
        else ""
    )
    try:
        loaded: object = json.loads(ci_file.read_text(encoding="utf-8"))
    except OSError, ValueError:
        loaded = None
    ci = cast("dict[str, object]", loaded) if isinstance(loaded, dict) else {}
    if ci.get("head") != head_summary(root):
        ci = {"result": "unverified", "reason": "No CI receipt for this Git HEAD"}
    return {
        "mode": state.get("mode", "normal"),
        "phase": state.get("phase", "ready"),
        "taskGoal": state.get("task_goal", ""),
        "scope": state.get("task_scope", []),
        "failures": state.get("consecutive_failures", 0),
        "decision": state.get("owner_decision", "pending"),
        "branch": branch(root),
        "dirty": len(business_changes(root)),
        "shortHead": head_summary(root),
        "history": history(root),
        "symbols": symbols,
        "ci": ci,
    }


def render(root: Path, *, serving: bool = False, token: str = "") -> Path:
    payload = {**facts(root), "serving": serving, "token": token}
    serial = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    serial = serial.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    html = dashboard_asset().read_text(encoding="utf-8").replace("__RILL_DATA__", serial)
    output = root / DASHBOARD_PATH
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    return output


def record_ci(root: Path, tier: str, status: str) -> None:
    """Record an observed CI execution against the current Git revision."""
    if tier not in {"ci", "core-full", "full"} or status not in {"running", "pass", "fail"}:
        raise ValueError("Unsupported CI receipt")
    summary: dict[str, object] = {
        "head": head_summary(root),
        "tier": tier,
        "result": status,
        "recorded_at": datetime.now(tz=UTC).isoformat(),
    }
    write_json(root, CI_SUMMARY_PATH, summary)


def receipt(root: Path, decision: str) -> None:
    if decision not in ALLOWED_DECISIONS:
        raise ValueError("Unsupported owner decision")
    state = load(root)
    state["owner_decision"] = decision
    save(root, state)


class _ReceiptServer(HTTPServer):
    def __init__(self, root: Path, token: str) -> None:
        self.root = root
        self.token = token
        self.accepted = False
        self.page = b""
        super().__init__((UI_HOST, UI_PORT), _Handler)


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if urlsplit(self.path).path != "/":
            self.send_error(404)
            return
        server = cast("_ReceiptServer", self.server)
        body = server.page
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        server = cast("_ReceiptServer", self.server)
        origin = f"http://{UI_HOST}:{server.server_port}"
        if self.path != "/decision" or self.headers.get("Origin") != origin:
            self.send_error(403)
            return
        if self.headers.get("Content-Type") != "application/json":
            self.send_error(415)
            return
        length = self.headers.get("Content-Length", "")
        if not length.isdecimal() or not 0 < int(length) <= MAX_POST_BYTES:
            self.send_error(413)
            return
        try:
            data: object = json.loads(self.rfile.read(int(length)))
            if (
                not isinstance(data, dict)
                or cast("dict[str, object]", data).get("token") != server.token
            ):
                raise ValueError("Invalid receipt token")
            selected = cast("dict[str, object]", data).get("decision")
            if not isinstance(selected, str):
                raise ValueError("Invalid owner decision")
            receipt(server.root, selected)
        except ValueError, UnicodeDecodeError:
            self.send_error(400)
            return
        self.send_response(204)
        self.end_headers()
        server.accepted = True

    def log_message(self, format: str, *args: object) -> None:
        return


def serve(root: Path, *, open_browser: bool = True) -> None:
    with _ReceiptServer(root, secrets.token_urlsafe(UI_TOKEN_BYTES)) as server:
        origin = f"http://{UI_HOST}:{server.server_port}"
        server.page = render(root, serving=True, token=server.token).read_bytes()
        print(origin, flush=True)
        if open_browser:
            webbrowser.open(origin)
        while not server.accepted:
            server.handle_request()
    render(root)
