import { describe, expect, it } from "vitest";

import { namedListings } from "@fixtures/named-listings";

import { getModerationRun, runModeration } from "./job";

describe("moderation job", () => {
  it("runs every rule once and indexes the result by uuid", () => {
    const run = runModeration(namedListings);

    expect(run.reviews).toHaveLength(namedListings.length);
    expect(run.byUuid.size).toBe(namedListings.length);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(new Date(run.ranAt).toString()).not.toBe("Invalid Date");
  });

  it("returns the same run until runModeration runs again", () => {
    const first = runModeration(namedListings);

    expect(getModerationRun()).toBe(first);
    expect(getModerationRun()).toBe(first);

    const second = runModeration(namedListings);

    expect(second).not.toBe(first);
    expect(getModerationRun()).toBe(second);
  });
});
