import type { Issue, Severity } from "./rules";

/** Worst to mildest. Use it for ordering and for picking a listing's status. */
export const SEVERITY_ORDER: readonly Severity[] = ["reject", "fix", "warn"];

/**
 * The worst severity among a listing's findings, or `null` when there are none.
 *
 * A `null` value means the listing passed every automated check; the rules now
 * run over every listing, so there are no "unchecked" rows.
 */
export function worstSeverity(issues: Issue[]): Severity | null {
  for (const severity of SEVERITY_ORDER) {
    if (issues.some((issue) => issue.severity === severity)) {
      return severity;
    }
  }
  return null;
}

/**
 * Orders queue rows worst first: reject, then fix, then warn, then rows with
 * no findings. Rows in the same band keep their original order.
 *
 * Pure: returns a new array and does not mutate `rows`.
 */
export function sortQueue<T extends { issues: Issue[] }>(rows: T[]): T[] {
  const band = (issues: Issue[]): number => {
    const severity = worstSeverity(issues);
    return severity ? SEVERITY_ORDER.indexOf(severity) : SEVERITY_ORDER.length;
  };

  return [...rows].sort((a, b) => band(a.issues) - band(b.issues));
}

/**
 * Counts how many rows fall into each severity band, plus the number that
 * passed every automated check.
 */
export function countBySeverity<T extends { issues: Issue[] }>(
  rows: T[],
): Record<Severity, number> & { passed: number } {
  const counts = { reject: 0, fix: 0, warn: 0, passed: 0 } as Record<Severity, number> & {
    passed: number;
  };

  for (const row of rows) {
    const severity = worstSeverity(row.issues);
    if (severity) {
      counts[severity]++;
    } else {
      counts.passed++;
    }
  }

  return counts;
}
