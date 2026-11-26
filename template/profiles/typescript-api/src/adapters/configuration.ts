import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function readConfiguration(port: string | undefined) {
  return createEnv({
    server: {
      PORT: z
        .string()
        .regex(/^[0-9]+$/u)
        .transform(Number)
        .pipe(z.int().min(1).max(65535))
        .default(3000),
    },
    runtimeEnvStrict: { PORT: port },
    onValidationError() {
      throw new Error("PORT must be a decimal integer from 1 to 65535");
    },
  });
}
