import { createHash } from "node:crypto";
import { z } from "zod";

const baseline = await Bun.file("contracts/baseline-openapi.json").text();
const provenance = z
  .strictObject({ revision: z.string().regex(/^[a-f0-9]{40}$/u), sha256: z.hash("sha256") })
  .parse(await Bun.file("contracts/baseline.json").json());

if (createHash("sha256").update(baseline).digest("hex") !== provenance.sha256) {
  throw new Error("OpenAPI baseline bytes do not match their recorded SHA-256");
}

const generated = Bun.spawnSync([process.execPath, "scripts/generate-openapi.ts"], {
  stderr: "inherit",
});
if (!generated.success) throw new Error("OpenAPI generation failed");
if (generated.stdout.toString() !== (await Bun.file("openapi.json").text())) {
  throw new Error("OpenAPI drift: regenerate openapi.json from the runtime schemas");
}
