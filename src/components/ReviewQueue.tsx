import Link from "next/link";

import type { Issue, Review } from "@/lib/moderation/rules";
import { countBySeverity, sortQueue, worstSeverity } from "@/lib/moderation/queue";

import { RunStatus } from "./RerunButton";

/**
 * The moderator's queue, sorted worst-first with a per-row status and rule summary.
 */
export function ReviewQueue({
  rows,
  checkedAt,
  durationMs,
}: {
  rows: Review[];
  checkedAt?: string;
  durationMs?: number;
}) {
  const sorted = sortQueue(rows);
  const counts = countBySeverity(rows);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Review queue</h1>
      <p>
        {rows.length.toLocaleString()} listings · {counts.reject.toLocaleString()} reject ·{" "}
        {counts.fix.toLocaleString()} fix · {counts.warn.toLocaleString()} warn ·{" "}
        {counts.passed.toLocaleString()} passed
      </p>
      {checkedAt !== undefined && durationMs !== undefined && (
        <RunStatus count={rows.length} durationMs={durationMs} checkedAt={checkedAt} />
      )}

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">App</th>
            <th className="py-2 pr-4">Developer</th>
            <th className="py-2 pr-4">Pricing</th>
            <th className="py-2 pr-4">Screenshots</th>
            <th className="py-2 pr-4">Rules</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ listing, issues }) => (
            <tr key={listing.uuid} className="border-b">
              <td className="py-2 pr-4">
                <Link href={`/listings/${listing.uuid}`} className="underline">
                  {listing.name}
                </Link>
              </td>
              <td className="py-2 pr-4">
                {listing.developer.handle ? `@${listing.developer.handle}` : "-"}
              </td>
              <td className="py-2 pr-4">{listing.pricingType}</td>
              <td className="py-2 pr-4">{listing.previewImageUrls.length}</td>
              <td className="py-2 pr-4">
                {issues.length > 0
                  ? [...new Set(issues.map((issue) => issue.rule))].join(", ")
                  : "-"}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge issues={issues} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StatusBadge({ issues }: { issues: Issue[] }) {
  const severity = worstSeverity(issues);

  const styles = {
    reject: "bg-red-100 text-red-700",
    fix: "bg-amber-100 text-amber-700",
    warn: "bg-slate-100 text-slate-700",
    passed: "bg-green-100 text-green-700",
  } as const;

  if (severity === null) {
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles.passed}`}
      >
        Passed
      </span>
    );
  }

  const label = `${severity}${issues.length > 0 ? ` · ${issues.length}` : ""}`;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}
    >
      {label}
    </span>
  );
}
