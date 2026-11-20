import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COUNTER_INITIAL_VALUE, COUNTER_STEP } from "@/lib/constants";

/** Interactive quality fixture exercised by unit tests and real Chromium E2E. */
export function App(): React.JSX.Element {
  const [count, setCount] = useState(COUNTER_INITIAL_VALUE);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center gap-6 p-8">
      <p className="text-sm font-semibold tracking-wide text-slate-500">
        Rill / UI quality fixture
      </p>
      <h1 className="text-3xl font-bold text-slate-900">UI quality gate</h1>
      <p className="text-slate-600">
        A real React interaction verifies that production builds and browser tests work together.
      </p>
      <Button type="button" onClick={() => setCount((current) => current + COUNTER_STEP)}>
        <Plus aria-hidden="true" className="size-4" />
        Increment counter
      </Button>
      <output aria-live="polite" className="text-sm text-slate-700">
        Clicks: {count}
      </output>
    </main>
  );
}
