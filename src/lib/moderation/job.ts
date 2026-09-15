import { getAllApps } from "@/lib/fanvue/api";

import { countBySeverity } from "./queue";
import { type Review, reviewListings } from "./rules";

export type ModerationRun = {
  ranAt: string;
  durationMs: number;
  reviews: Review[];
  byUuid: Map<string, Review>;
};

let latest: ModerationRun | null = null;

/** Runs every rule over the store once and keeps the result; what a scheduled job would produce. */
export function runModeration(listings = getAllApps()): ModerationRun {
  const started = performance.now();
  const reviews = reviewListings(listings);
  const durationMs = Math.round(performance.now() - started);
  const run: ModerationRun = {
    ranAt: new Date().toISOString(),
    durationMs,
    reviews,
    byUuid: new Map(reviews.map((review) => [review.listing.uuid, review])),
  };
  latest = run;
  console.info("[moderation] reviewed", {
    listings: reviews.length,
    ...countBySeverity(reviews),
    durationMs,
    at: run.ranAt,
  });
  return run;
}

/** The most recent run, computing one on first call. */
export function getModerationRun(): ModerationRun {
  return latest ?? runModeration();
}
