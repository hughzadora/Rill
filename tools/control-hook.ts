import { type ControlEvent, evaluateEvent } from "./control-event.ts";

let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
  const event: unknown = JSON.parse(input);
  if (
    !event ||
    typeof event !== "object" ||
    !("hook_event_name" in event) ||
    !("cwd" in event) ||
    !("session_id" in event) ||
    typeof event.hook_event_name !== "string" ||
    typeof event.cwd !== "string" ||
    typeof event.session_id !== "string"
  )
    throw new Error("Invalid native lifecycle input");
  const value: ControlEvent = {
    hook_event_name: event.hook_event_name,
    cwd: event.cwd,
    session_id: event.session_id,
  };
  console.log(JSON.stringify(evaluateEvent(value)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
