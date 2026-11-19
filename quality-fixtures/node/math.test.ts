import { describe, expect, it } from "vitest";
import { add } from "./math.js";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(20, 22)).toBe(42);
  });
});
