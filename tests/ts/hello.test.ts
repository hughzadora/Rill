import { describe, expect, it } from "vitest";
import { hello } from "../../src/ts/hello.js";

describe("hello", () => {
  it("greets a supplied name", () => {
    expect(hello("Rill")).toBe("Hello, Rill!");
  });

  it("preserves an empty name without inventing a fallback", () => {
    expect(hello("")).toBe("Hello, !");
  });
});
