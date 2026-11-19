import { describe, expect, it } from "vitest";
import { multiply } from "./math.js";

describe("multiply", () => {
  it("multiplies two numbers", () => {
    expect(multiply(6, 7)).toBe(42);
  });
});
