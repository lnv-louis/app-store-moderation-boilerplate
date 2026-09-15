import { describe, expect, it } from "vitest";

import type { AppListing } from "@/lib/fanvue/types";

import { reviewListings } from "./rules";

/** A listing that should pass every check. Copy it and break one thing per test. */
const cleanListing: AppListing = {
  uuid: "00000000-0000-4000-8000-00000000c1ea",
  name: "Post Planner",
  tagline: "Plan and schedule your posts in one calendar",
  description: "A weekly content calendar with drag-and-drop scheduling and reminders.",
  logoUrl: "https://placehold.co/256x256/png?text=PP",
  appUrl: "https://postplanner.app",
  pricingType: "monthly",
  rating: { average: 4.5, count: 40 },
  developer: { name: "Quarterlight", handle: "quarterlight" },
  descriptionTitle: "Never miss a posting slot",
  descriptionBody:
    "Post Planner shows your upcoming week at a glance, suggests gaps, and reminds you before each slot.",
  highlights: ["Weekly calendar", "Drag-and-drop scheduling", "Reminders"],
  heroImageUrl: "https://placehold.co/1200x630/png?text=Post+Planner",
  previewImageUrls: [
    "https://placehold.co/800x500/png?text=Preview+1",
    "https://placehold.co/800x500/png?text=Preview+2",
  ],
  galleryImageUrls: ["https://placehold.co/1280x800/png?text=Calendar"],
  pricingPlans: [
    {
      uuid: "00000000-0000-4000-8000-00000000c1eb",
      name: "Pro",
      description: "Unlimited scheduled posts.",
      billingType: "recurring",
      interval: "monthly",
      price: 999,
      currencyCode: "USD",
      status: "active",
      highlights: ["Unlimited posts", "Email reminders"],
    },
  ],
  ratingDistribution: null,
};

/** Findings for one listing on its own. Pass several listings when a rule compares them. */
const findingsFor = (listing: AppListing) => reviewListings([listing])[0]!.issues;

describe("moderation rules", () => {
  it("returns no findings for a clean listing", () => {
    expect(findingsFor(cleanListing)).toEqual([]);
  });

  it("flags a listing with the same screenshot twice (2.3)", () => {
    const padded: AppListing = {
      ...cleanListing,
      previewImageUrls: [cleanListing.previewImageUrls[0]!, cleanListing.previewImageUrls[0]!],
    };

    expect(findingsFor(padded).map((issue) => issue.rule)).toEqual(["2.3"]);
  });

  it("flags a missing appUrl (6.2)", () => {
    const listing: AppListing = { ...cleanListing, appUrl: null };

    expect(findingsFor(listing).map((issue) => issue.code)).toEqual(["app_url_missing"]);
  });

  it("flags a fanvue.com subdomain but not a domain that merely names fanvue (6.2)", () => {
    const onFanvue: AppListing = { ...cleanListing, appUrl: "https://fanradar.fanvue.com" };
    const namedAfter: AppListing = { ...cleanListing, appUrl: "https://copilot-fanvue-tools.com" };

    expect(findingsFor(onFanvue).map((issue) => issue.code)).toEqual(["app_url_fanvue_domain"]);
    expect(findingsFor(namedAfter)).toEqual([]);
  });

  it("flags plain http and a parking host as two findings (6.2)", () => {
    const listing: AppListing = { ...cleanListing, appUrl: "http://x.parkingcrew.net" };

    expect(findingsFor(listing).map((issue) => issue.code).sort()).toEqual(
      ["app_url_not_https", "app_url_parking_host"].sort(),
    );
  });

  it("flags an IP address host but not a port (6.2)", () => {
    const ipHost: AppListing = { ...cleanListing, appUrl: "https://1.2.3.4" };
    const withPort: AppListing = { ...cleanListing, appUrl: "https://example.com:3000/path" };

    expect(findingsFor(ipHost).map((issue) => issue.code)).toEqual(["app_url_ip_host"]);
    expect(findingsFor(withPort)).toEqual([]);
  });
});
