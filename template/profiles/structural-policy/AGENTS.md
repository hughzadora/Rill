# Structural policy profile

`mise run scan-structure` enforces `Bun.write` placement in `src/**` and `tests/**`.

- Call records, sanitization, and pure transformations belong in functions named `preview<Capitalized>` and must not write.
- Explicit persistence belongs in a function whose name does not match that preview prefix.
- Use a named import of `write` from `"bun"` for the save boundary; direct, computed, aliased, and imported preview writes all report `no-preview-write-ts` or `no-preview-write-tsx`.
- Add `.ts` and `.tsx` rule tests under `rule-tests/` for each new call or escape shape. Run the native rule test and qualification before accepting the rule.
- The scanner intentionally covers only `.ts` and `.tsx`. Qualification rejects other TypeScript/JavaScript extensions and inline suppressions rather than treating them as unscanned passes.

The sample export and preview components are replaceable project inputs at this policy boundary, not a product mandate.
