import { describe, expect, it } from "vitest";
import { hello } from "../../src/ts/hello.js";

describe("hello", () => {
  it("greets the supplied name", () => {
    expect(hello("Rill")).toBe("Hello, Rill!");
  });
});
