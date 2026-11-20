import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";

test("the actual browser entry mounts the accessible app", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import("./main");
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Inventory Console" }),
    ).toBeInTheDocument();
  });
});
