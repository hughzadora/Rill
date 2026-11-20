import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Counter } from "./Counter";

test("inventory accepts and ships actual stock", async () => {
  const user = userEvent.setup();
  render(<Counter />);
  expect(screen.getByRole("status")).toHaveTextContent("Available stock: 0");
  await user.click(screen.getByRole("button", { name: "Restock" }));
  expect(screen.getByRole("status")).toHaveTextContent("Available stock: 1");
  await user.click(screen.getByRole("button", { name: "Ship" }));
  expect(screen.getByRole("status")).toHaveTextContent("Available stock: 0");
});

test("empty inventory refuses invalid shipment and recovers", async () => {
  const user = userEvent.setup();
  render(<Counter />);
  await user.click(screen.getByRole("button", { name: "Ship" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Cannot ship an empty inventory",
  );
  await user.click(screen.getByRole("button", { name: "Restock" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
