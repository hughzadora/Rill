import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/App";

afterEach(cleanup);

describe("App", () => {
  it("renders the page and reacts to successive clicks", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "UI quality gate" })).toBeTruthy();
    const status = screen.getByRole("status");
    const button = screen.getByRole("button", { name: "Increment counter" });

    expect(status.textContent).toBe("Clicks: 0");
    fireEvent.click(button);
    expect(status.textContent).toBe("Clicks: 1");
    fireEvent.click(button);
    expect(status.textContent).toBe("Clicks: 2");
  });
});
