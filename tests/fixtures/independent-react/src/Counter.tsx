import { useState } from "react";

export function Counter() {
  const [items, setItems] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function restock() {
    setItems((value) => value + 1);
    setError(null);
  }

  function ship() {
    if (items === 0) {
      setError("Cannot ship an empty inventory");
      return;
    }
    setItems((value) => value - 1);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">Inventory Console</h1>
      <p role="status" className="mt-4">
        Available stock: {items}
      </p>
      <div className="mt-5 flex gap-3">
        <button
          className="rounded border px-4 py-2"
          onClick={restock}
          type="button"
        >
          Restock
        </button>
        <button
          className="rounded border px-4 py-2"
          onClick={ship}
          type="button"
        >
          Ship
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4">
          {error}
        </p>
      )}
    </main>
  );
}
