import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("removes conflicting Tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("combines conditional classes without invalid values", () => {
    expect(cn("flex", false, { hidden: true, block: false })).toBe("hidden");
  });
});
