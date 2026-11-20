import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("renders an accessible button with the default variant", () => {
    render(<Button type="button">Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.className).toContain("bg-slate-900");
  });

  it("supports size and variant changes and forwards click events", () => {
    const onClick = vi.fn();
    render(
      <Button type="button" size="sm" variant="outline" onClick={onClick}>
        Confirm
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Confirm" });
    expect(button.className).toContain("border-slate-300");
    expect(button.className).toContain("h-8");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("forwards disabled semantics instead of triggering events", () => {
    const onClick = vi.fn();
    render(
      <Button type="button" disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disabled" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("composes a link through Radix Slot", () => {
    render(
      <Button asChild variant="ghost">
        <a href="/help">Help</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Help" });
    expect(link.getAttribute("href")).toBe("/help");
    expect(link.className).toContain("hover:bg-slate-100");
  });

  it("exposes the default and explicit CVA variants", () => {
    expect(buttonVariants()).toContain("bg-slate-900");
    expect(buttonVariants({ variant: "ghost" })).toContain("text-slate-900");
    expect(buttonVariants({ size: "lg" })).toContain("h-11");
  });
});
