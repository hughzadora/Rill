import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  cachedTask,
  pendingRecords,
  projectContext,
} from "../tools/task-context.ts";
import { fixtureProject, taskUrl } from "./helpers/project.ts";

describe("actual task CLI and test-owned GitHub transport", () => {
  let fixture: ReturnType<typeof fixtureProject>;
  beforeEach(() => {
    fixture = fixtureProject();
  });
  afterEach(() => {
    fixture.cleanup();
  });
  const sync = () => {
    const result = fixture.run("sync", taskUrl);
    expect(result.status, result.stderr).toBe(0);
  };
  const pending = () => pendingRecords(projectContext(fixture.root));
  const enqueue = () => {
    const record = fixture.record();
    const result = fixture.run("record", fixture.recordPath(record));
    expect(result.status, result.stderr).toBe(0);
    return record;
  };

  test("retains the last page of authoritative comments", () => {
    sync();
    expect(
      cachedTask(projectContext(fixture.root)).comments.map(
        (entry) => entry.body,
      ),
    ).toEqual(["first page", "last-page requirement R-7"]);
  });
  test("retains unsynchronized facts across offline CLI restarts and refuses an offline task switch", () => {
    sync();
    const record = enqueue();
    fixture.state.offline = true;
    fixture.save();
    const result = fixture.run("sync", taskUrl);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe("cached");
    expect(pending().map((entry) => entry.id)).toEqual([record.id]);
    expect(
      fixture.run("sync", "https://github.com/example/project/issues/8").status,
    ).toBe(1);
    expect(cachedTask(projectContext(fixture.root)).taskUrl).toBe(taskUrl);
  });
  test("reconciles an unknown POST result without repeating the external write", () => {
    sync();
    const record = enqueue();
    fixture.state.failAfterPost = true;
    fixture.save();
    expect(fixture.run("publish").status).toBe(1);
    expect(pending()[0]?.id).toBe(record.id);
    fixture.reload();
    expect(fixture.state.posts).toBe(1);
    const retried = fixture.run("publish");
    expect(retried.status, retried.stderr).toBe(0);
    fixture.reload();
    expect(fixture.state.posts).toBe(1);
    expect(pending()).toEqual([]);
    expect(
      cachedTask(projectContext(fixture.root)).comments.some((entry) =>
        entry.body?.includes(record.id),
      ),
    ).toBe(true);
  });
  test("keeps the outbox when approved scope changes remotely", () => {
    sync();
    enqueue();
    fixture.state.issue.body = "Owner changed the approved scope";
    fixture.save();
    const result = fixture.run("publish");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Remote scope or task state changed");
    expect(pending()).toHaveLength(1);
    fixture.reload();
    expect(fixture.state.posts).toBe(0);
  });
  test("requires exact external readback before removing a pending fact", () => {
    sync();
    enqueue();
    fixture.state.mismatchReadback = true;
    fixture.save();
    expect(fixture.run("publish").status).toBe(1);
    expect(pending()).toHaveLength(1);
    fixture.reload();
    expect(fixture.state.posts).toBe(1);
    fixture.state.mismatchReadback = false;
    fixture.save();
    expect(fixture.run("publish").status).toBe(0);
    fixture.reload();
    expect(fixture.state.posts).toBe(1);
    expect(pending()).toHaveLength(0);
  });
  test("rejects a mismatched remote identity without overwriting the valid snapshot", () => {
    sync();
    fixture.state.invalidIdentity = true;
    fixture.save();
    expect(fixture.run("sync", taskUrl).status).toBe(1);
    expect(cachedTask(projectContext(fixture.root)).issue.number).toBe(7);
  });
  test("rejects wrong-task and malformed records before publication", () => {
    sync();
    const record = fixture.record();
    expect(
      fixture.run(
        "record",
        fixture.recordPath({
          ...record,
          taskUrl: "https://github.com/example/project/issues/8",
        }),
      ).status,
    ).toBe(1);
    expect(
      fixture.run("record", fixture.recordPath({ ...record, id: "not-a-uuid" }))
        .status,
    ).toBe(1);
    expect(pending()).toHaveLength(0);
  });
});
