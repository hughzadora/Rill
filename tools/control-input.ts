import * as z from "zod/v4";

export const controlEventSchema = z
  .object({
    hook_event_name: z.string().min(1),
    cwd: z.string().min(1),
    session_id: z.string().min(1),
    turn_id: z.string().optional(),
    tool_name: z.string().optional(),
    tool_use_id: z.string().optional(),
    tool_input: z.unknown().optional(),
    tool_response: z.unknown().optional(),
    source: z.string().optional(),
    trigger: z.string().optional(),
  })
  .passthrough();

export type ControlEvent = z.infer<typeof controlEventSchema>;
