import { controlEventSchema } from "./control-input.ts";
import { lifecycleEvent } from "./recovery-lifecycle.ts";

let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
  const event = controlEventSchema.parse(JSON.parse(input));
  console.log(
    JSON.stringify(await lifecycleEvent(event, AbortSignal.timeout(20_000))),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
