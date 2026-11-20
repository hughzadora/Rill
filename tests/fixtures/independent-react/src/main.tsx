import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Counter } from "./Counter";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Inventory mounting element missing");

createRoot(container).render(
  <StrictMode>
    <Counter />
  </StrictMode>,
);
