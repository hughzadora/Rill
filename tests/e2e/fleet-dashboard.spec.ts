import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "./fixtures";

const DEMO_ASSET_COUNT = 3;

test("generated offline fleet dashboard responds to search, theme and action decisions", async ({
  page,
}) => {
  const temp = mkdtempSync(join(tmpdir(), "rill-browser-fleet-"));
  try {
    const command = resolve(process.cwd(), ".venv/bin/rill");
    const result = spawnSync(command, ["fleet", "dashboard", "--demo", "--no-open"], {
      cwd: process.cwd(),
      env: { ...process.env, XDG_DATA_HOME: temp },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const html = join(temp, "rill", "fleet-dashboard.html");
    await page.goto(pathToFileURL(html).href);
    await expect(page).toHaveTitle("Rill Fleet | Local operations");
    await expect(page.locator("#demoLabel")).toBeVisible();
    await expect(page.locator("#assetCount")).toHaveText("3");
    await expect(page.locator("#assets tr")).toHaveCount(DEMO_ASSET_COUNT);
    await page.getByRole("searchbox", { name: "Filter projects and assets" }).fill("reviewer");
    await expect(page.locator("#assets tr")).toHaveCount(1);
    await expect(page.locator("#assets")).toContainText("reviewer");
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Rollback snapshot" }).click();
    await expect(page.locator("#decisionMessage")).toContainText(
      "explicit confirmation is required",
    );
    await expect(page.locator("#decisionMessage")).toContainText("rollback selected");
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
