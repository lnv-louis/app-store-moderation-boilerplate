"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * When the checks last ran, how long they took, and a button that triggers a
 * fresh server render so the queue re-runs the validator.
 */
export function RunStatus({
  count,
  durationMs,
  checkedAt,
}: {
  count: number;
  durationMs: number;
  checkedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <p className="text-sm text-slate-600">
      Checked {count.toLocaleString()} listings against 6 rules in {durationMs} ms at{" "}
      {new Date(checkedAt).toLocaleTimeString()}{" "}
      <button
        type="button"
        className="underline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Re-running…" : "Re-run checks"}
      </button>
    </p>
  );
}
