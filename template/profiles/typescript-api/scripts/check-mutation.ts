import { z } from "zod";

const report = z
  .object({
    files: z.record(
      z.string(),
      z.object({
        mutants: z.array(z.object({ id: z.string(), status: z.string() })).nonempty(),
      }),
    ),
  })
  .parse(await Bun.file("reports/mutation/mutation.json").json());

const entries = Object.entries(report.files);
const target = entries[0];
if (!target || entries.length !== 1 || target[0] !== "src/domain/capacity.ts") {
  throw new Error("Mutation report must cover exactly src/domain/capacity.ts");
}
const unresolved = target[1].mutants.filter(({ status }) => status !== "Killed");
if (unresolved.length > 0) {
  throw new Error(`Mutation report has unresolved outcomes: ${JSON.stringify(unresolved)}`);
}
console.log(`Confirmed ${target[1].mutants.length} assertion-killed capacity mutants.`);
