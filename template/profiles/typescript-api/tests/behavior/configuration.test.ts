import { expect, test } from "bun:test";
import { readConfiguration } from "../../src/adapters/configuration";

test("uses the default port and accepts an explicitly configured port", () => {
  expect(readConfiguration(undefined)).toEqual({ PORT: 3000 });
  expect(readConfiguration("4200")).toEqual({ PORT: 4200 });
});

test.each(["", "secret-like-value", "0", "-1", "65536", "1.5", "0x42"])(
  "rejects invalid port input before listening with a redacted message",
  (value) => {
    expect(() => readConfiguration(value)).toThrow(
      "PORT must be a decimal integer from 1 to 65535",
    );
  },
);

test("an invalid environment prevents the real server process from starting", async () => {
  const child = Bun.spawn([process.execPath, "--no-env-file", "src/server.ts"], {
    env: { ...process.env, PORT: "test-private-config-marker" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [status, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout.text(),
    child.stderr.text(),
  ]);
  expect(status).not.toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toContain("PORT must be a decimal integer from 1 to 65535");
  expect(stderr).not.toContain("test-private-config-marker");
});
