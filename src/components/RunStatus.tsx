"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { rerunModeration } from "@/lib/moderation/actions";

/**
 * When the checks last ran, how long they took, and a button that re-runs the
 * moderation job on the server and refreshes the queue.
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
      Checked {count.toLocaleString("en-US")} listings in {durationMs} ms at {checkedAt.slice(11, 19)} UTC{" "}
      <button
        type="button"
        className="underline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await rerunModeration();
            router.refresh();
          })
        }
      >
        {pending ? "Re-running…" : "Re-run checks"}
      </button>
    </p>
  );
}
