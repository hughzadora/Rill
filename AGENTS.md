# Rill engineering policy

1. **No append-only patching.** Refactor coherently and remove obsolete code.
   Never preserve dead code or invent legacy compatibility directories.
2. **Single source of truth.** Mise manages CLI tool versions and their lock.
   The root justfile owns every CI task. No external orchestration wrappers.
3. **Standard layout.** Put TypeScript and shell sources in src/ts or src/sh.
   Use a named Python package in src/rill_quality; tests belong in tests/ts,
   tests/py or tests/sh. Browser E2E tests belong in tests/e2e.
4. **Use upstream libraries.** For Python HTTP use httpx; avoid hand-rolled
   networking or CLI frameworks. Forbid as-any casts, TypeScript ignores,
   and unspecific Python type ignores; fix causes instead of suppressing checks.
5. **Complexity limits.** Functions must be at most 60 lines, have
   cyclomatic complexity at most 12, and accept at most five parameters.
   Never duplicate code by copy-pasting blocks over five lines.
6. **Vite and shadcn/ui conventions.** Use the cn() utility from @/lib/utils
   for merging Tailwind classes; never hand-concatenate conditional classes.
   Place reusable primitives in src/ts/components/ui, and application features
   in src/ts/components or src/ts/pages.
7. **Real interaction tests.** New user interactions require both focused
   tests/ts/*.test.tsx unit tests and tests/e2e/*.spec.ts browser tests.
   Run production Vite builds before Playwright against the built preview.
8. **Proof before delivery.** Run just ci-full and require exit status zero,
   including coverage, tests, browser checks and security scans.
   Never claim a gate passed without checking actual execution.
9. **Preserve Git history.** Document the change in its issue and PR.
   The CI pipeline must remain reproducible on a clean machine.

## 人类零代码全托管最高禁令（Zero-Touch Governance）

1. **严禁篡改护栏配置**：任何情况下，严禁为了通过 CI 而放宽、注释或修改
   `justfile`、`biome.json`、`pyproject.toml`、`.semgrep.yml`、
   `tsconfig.json`、`vitest.config.ts`、`stryker.config.json`
   中的任何规则阈值。若业务确实需要调整，必须先停下来向人类审批者申请明确授权。
2. **严禁伪造测试（Anti-Mock-Abuse）**：禁止编写无实质断言
   （如仅 `expect(true).toBe(true)`）或硬编码迎合 Bug 的测试。
   重要业务模块完成后，必须主动运行 `just verify-tests` 确保变异得分达标。
3. **前后端契约唯一来源**：前后端交互数据模型必须由后端
   （如 FastAPI OpenAPI）自动导出 Schema，前端使用
   `openapi-typescript` 生成类型，严禁前后端各自手写重复接口定义。
