import { describe, expect, it } from "vitest";

import type { Issue, Severity } from "./rules";
import { countBySeverity, sortQueue, worstSeverity } from "./queue";

const issue = (severity: Severity): Issue => ({
  code: "test",
  rule: "2.3",
  severity,
  message: "test",
});

describe("moderation queue", () => {
  describe("worstSeverity", () => {
    it("returns null for an empty list of issues", () => {
      expect(worstSeverity([])).toBe(null);
    });

    it("returns the first severity present in SEVERITY_ORDER", () => {
      expect(worstSeverity([issue("warn")])).toBe("warn");
      expect(worstSeverity([issue("fix"), issue("warn")])).toBe("fix");
      expect(worstSeverity([issue("reject"), issue("fix")])).toBe("reject");
      expect(worstSeverity([issue("warn"), issue("reject")])).toBe("reject");
    });
  });

  describe("sortQueue", () => {
    it("orders rows reject, fix, warn, then passed", () => {
      const rows = [
        { issues: [issue("warn")] },
        { issues: [issue("reject")] },
        { issues: [issue("fix")] },
        { issues: [] },
      ];

      expect(sortQueue(rows).map((row) => worstSeverity(row.issues))).toEqual([
        "reject",
        "fix",
        "warn",
        null,
      ]);
    });

    it("is stable within a band", () => {
      const rows: { id: string; issues: Issue[] }[] = [
        { id: "a", issues: [issue("fix")] },
        { id: "b", issues: [issue("fix")] },
        { id: "c", issues: [issue("warn")] },
        { id: "d", issues: [] },
        { id: "e", issues: [issue("reject")] },
      ];

      expect(sortQueue(rows).map((row) => row.id)).toEqual(["e", "a", "b", "c", "d"]);
    });

    it("does not mutate the input array", () => {
      const rows = [
        { id: "first", issues: [issue("warn")] },
        { id: "second", issues: [issue("reject")] },
      ];
      const original = [...rows];

      sortQueue(rows);

      expect(rows).toEqual(original);
    });
  });

  describe("countBySeverity", () => {
    it("counts rows by their worst severity", () => {
      const rows = [
        { issues: [issue("reject")] },
        { issues: [issue("fix"), issue("warn")] },
        { issues: [issue("warn")] },
        { issues: [] },
        { issues: [] },
      ];

      expect(countBySeverity(rows)).toEqual({
        reject: 1,
        fix: 1,
        warn: 1,
        passed: 2,
      });
    });
  });
});
