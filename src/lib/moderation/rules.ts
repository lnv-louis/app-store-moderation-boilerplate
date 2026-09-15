import type { AppListing } from "@/lib/fanvue/types";

export type Severity = "reject" | "fix" | "warn";

/**
 * One moderation finding on a listing.
 *
 * - `code`: stable machine-readable id for the check (e.g. `"too_few_screenshots"`).
 * - `rule`: section number from `docs/listing-requirements.md` (e.g. `"2.3"`).
 * - `severity`: what should happen next. Your call per rule, and we will ask why.
 * - `message`: what a moderator reads.
 * - `field`: optional path into the listing, e.g. `appUrl` or `pricingPlans[0].price`.
 */
export type Issue = {
  code: string;
  rule: string;
  severity: Severity;
  message: string;
  field?: string;
};

/** One listing and everything the rules found on it. */
export type Review = {
  listing: AppListing;
  issues: Issue[];
};

/**
 * Reviews a set of listings and returns the findings for each, in the order
 * they came in.
 *
 * This is the entry point the spec test calls and the pages render, and it
 * takes the whole set rather than one listing. How the work inside is
 * organised is up to you.
 *
 * Pure: no I/O, and the same input always gives the same output.
 */
export function reviewListings(listings: AppListing[]): Review[] {
  const duplicates = findDuplicateDescriptions(listings); // 4.2, Issue[][] aligned to input
  return listings.map((listing, i) => ({ listing, issues: [...checkListing(listing), ...duplicates[i]!] }));
}

/** Every check that only needs the one listing in front of it. */
function checkListing(listing: AppListing): Issue[] {
  return [
    ...checkPlatformMentions(listing),
    ...checkProductionReady(listing),
    ...checkScreenshotCount(listing),
    ...checkPricingAccuracy(listing),
    ...checkAppUrl(listing),
  ];
}

/** Lowercase, optionally fold leet digits to letters, and split on anything non-alphanumeric. */
function words(text: string, leet = false): string[] {
  let lowered = text.toLowerCase();
  if (leet) {
    lowered = lowered.replace(/[013457]/g, (digit) => ({ 0: "o", 1: "l", 3: "e", 4: "a", 5: "s", 7: "t" })[digit]!);
  }
  return lowered.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

/**
 * §1.6: "the app name, tagline, description, description title and body, and
 * the listing highlights."
 */
function copyFields(listing: AppListing): [field: string, text: string][] {
  return [
    ["name", listing.name],
    ["tagline", listing.tagline],
    ["description", listing.description],
    ["descriptionTitle", listing.descriptionTitle],
    ["descriptionBody", listing.descriptionBody],
    ...listing.highlights.map((text, i): [string, string] => [`highlights[${i}]`, text]),
  ];
}

/**
 * Rule 1.6: "A listing must not name or promote a competing creator platform…
 * digits standing in for letters (`0nlyFans`, `Fans1y`), separators inserted
 * between the words (`only.fans`, `Only Fans`, `only-fans`), or unusual
 * casing."
 *
 * Every window of 1–3 adjacent tokens (leet folded) is compared against the
 * canonical names, so `only.fans` and `just for fans` collapse to a hit while
 * a bare `fans` does not.
 *
 * `reject` because promoting a competitor is a content bar, not a typo.
 */
function checkPlatformMentions(listing: AppListing): Issue[] {
  const platforms = new Set(["onlyfans", "fansly", "patreon", "loyalfans", "manyvids", "justforfans"]);
  const issues: Issue[] = [];

  for (const [field, text] of copyFields(listing)) {
    const tokens = words(text, true);
    const hit = tokens.some((_, i) =>
      [1, 2, 3].some((width) => platforms.has(tokens.slice(i, i + width).join(""))),
    );
    if (hit) {
      issues.push({
        code: "platform_mention",
        rule: "1.6",
        severity: "reject",
        message: `${field} names a competing creator platform: "${text}".`,
        field,
      });
    }
  }

  return issues;
}

/**
 * Rule 2.1: "the markers we see are consistent: `lorem`, `ipsum`, `TODO`,
 * `TBD`, `FIXME`, `coming soon`, `placeholder`, `sample text`. Empty listing
 * highlights are the other common sign of a listing submitted half-written."
 *
 * `fix` because deleting the placeholder or adding highlights is mechanical.
 */
function checkProductionReady(listing: AppListing): Issue[] {
  const markers = /\b(lorem|ipsum|todo|tbd|fixme|coming soon|placeholder|sample text)\b/;
  const issues: Issue[] = copyFields(listing)
    .filter(([, text]) => markers.test(words(text, true).join(" ")))
    .map(([field]) => ({
      code: "placeholder_copy",
      rule: "2.1",
      severity: "fix",
      message: `${field} still carries draft or placeholder copy.`,
      field,
    }));

  if (listing.highlights.filter((highlight) => highlight.trim()).length === 0) {
    issues.push({
      code: "empty_highlights",
      rule: "2.1",
      severity: "fix",
      message: "No listing highlights; rule 2.1 reads that as a half-written submission.",
      field: "highlights",
    });
  }

  return issues;
}

/**
 * Rule 3.3: "A plan priced outside the supported range… A price in the copy
 * that no plan matches… A free tier that does not exist." The range is
 * $3.99–$500.00 (pricing-plans.md); only `active` and `pending_setup` plans
 * can satisfy a copy claim — a withdrawn plan is still range-checked but is
 * not purchasable.
 *
 * `fix` because correcting the price or the copy is mechanical.
 */
function checkPricingAccuracy(listing: AppListing): Issue[] {
  const issues: Issue[] = [];
  const purchasable = listing.pricingPlans.filter((plan) => plan.status !== "withdrawn");

  listing.pricingPlans.forEach((plan, i) => {
    if (plan.billingType !== "free" && (plan.price < 399 || plan.price > 50000)) {
      issues.push({
        code: "plan_price_out_of_range",
        rule: "3.3",
        severity: "fix",
        message: `Plan "${plan.name}" is $${(plan.price / 100).toFixed(2)}; supported range is $3.99–$500.00.`,
        field: `pricingPlans[${i}].price`,
      });
    }
  });

  const priceMentions = /\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?usd\b/g;
  for (const [field, text] of copyFields(listing)) {
    const seen = new Set<number>();
    for (const match of text.toLowerCase().matchAll(priceMentions)) {
      const cents = Math.round(parseFloat(match[1] ?? match[2]!) * 100);
      if (!seen.has(cents) && !purchasable.some((plan) => plan.price === cents)) {
        seen.add(cents);
        issues.push({
          code: "copy_price_unmatched",
          rule: "3.3",
          severity: "fix",
          message: `${field} quotes $${(cents / 100).toFixed(2)} but no active plan costs that.`,
          field,
        });
      }
    }
    if (
      /\bfree (plan|tier|forever|to start)\b/.test(text.toLowerCase()) &&
      !purchasable.some((plan) => plan.billingType === "free" || plan.price === 0)
    ) {
      issues.push({
        code: "free_tier_missing",
        rule: "3.3",
        severity: "fix",
        message: `${field} advertises a free tier but the listing has no free plan.`,
        field,
      });
    }
  }

  return issues;
}

/**
 * Rule 4.2: "Compare on `description` and `descriptionBody`, ignoring case,
 * punctuation and the app's own name… Two listings that match each other are
 * both flagged."
 *
 * Each listing's own name is stripped as a phrase, then 3-word shingles are
 * compared by Jaccard similarity; pairs at or above 0.5 flag both members.
 *
 * `warn` because §4.2 says "a human decides which of them was first" — the
 * tool can only point at the pair.
 */
function findDuplicateDescriptions(listings: AppListing[]): Issue[][] {
  const shingleSets = listings.map((listing) => {
    const ownName = new RegExp(`\\b${words(listing.name).join("\\W+")}\\b`, "i");
    const tokens = words(`${listing.description} ${listing.descriptionBody}`.replace(ownName, " "));
    return new Set(tokens.slice(0, -2).map((_, i) => tokens.slice(i, i + 3).join(" ")));
  });

  const results: Issue[][] = listings.map(() => []);
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const [a, b] = [shingleSets[i]!, shingleSets[j]!];
      if (a.size === 0 || b.size === 0) continue;
      const shared = [...a].filter((shingle) => b.has(shingle)).length;
      if (shared / (a.size + b.size - shared) < 0.5) continue;
      for (const [self, other] of [[i, j], [j, i]] as const) {
        results[self]!.push({
          code: "duplicate_description",
          rule: "4.2",
          severity: "warn",
          message: `Description is a near-copy of "${listings[other]!.name}"; a human decides which came first.`,
          field: "description",
        });
      }
    }
  }
  return results;
}

/**
 * Rule 6.2: "We reject a listing when the URL: is missing; is not `https`;
 * has no host, or has an IP address for a host; is on `fanvue.com` or any
 * subdomain of it; is on a domain-parking or site-builder placeholder host."
 * And "A domain that merely has our name inside it is fine."
 *
 * `fix` because a developer can point the listing at a URL they own without
 * anyone making a judgement call.
 */
function checkAppUrl(listing: AppListing): Issue[] {
  const issue = (code: string, message: string): Issue => ({
    code,
    rule: "6.2",
    severity: "fix",
    message,
    field: "appUrl",
  });

  if (listing.appUrl === null) {
    return [issue("app_url_missing", "No appUrl; rule 6.2 needs a working address the developer owns.")];
  }

  let url: URL;
  try {
    url = new URL(listing.appUrl);
  } catch {
    return [issue("app_url_invalid", `appUrl "${listing.appUrl}" is not a parseable URL.`)];
  }

  const host = url.hostname;
  const onDomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  const issues: Issue[] = [];

  if (url.protocol !== "https:") {
    issues.push(issue("app_url_not_https", `appUrl is ${url.protocol}//…; rule 6.2 requires https.`));
  }
  if (host === "" || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    issues.push(issue("app_url_ip_host", `appUrl host "${host}" is an IP address, not a domain the developer owns.`));
  }
  if (onDomain("fanvue.com")) {
    issues.push(issue("app_url_fanvue_domain", `appUrl is hosted on ${host}; the app must not live on fanvue.com.`));
  }
  const parkingHost = ["parkingcrew.net", "sedoparking.com", "afternic.com", "godaddysites.com", "wixsite.com"].find(
    onDomain,
  );
  if (parkingHost) {
    issues.push(issue("app_url_parking_host", `appUrl is on ${parkingHost}, a parking or site-builder placeholder host.`));
  }

  return issues;
}

/**
 * Rule 2.3, and the worked example for the rest: "At least two screenshots of
 * the product... Two entries pointing at the same image are one screenshot,
 * not two."
 *
 * `fix` because a developer can add a screenshot without anyone making a
 * judgement call. Argue for something else if you disagree — bring the
 * accept-with-fixes bar in 4.5 with you.
 */
function checkScreenshotCount(listing: AppListing): Issue[] {
  const distinct = new Set(listing.previewImageUrls).size;
  if (distinct >= 2) return [];

  return [
    {
      code: "too_few_screenshots",
      rule: "2.3",
      severity: "fix",
      message:
        distinct === listing.previewImageUrls.length
          ? `Only ${distinct} screenshot${distinct === 1 ? "" : "s"}; rule 2.3 needs two.`
          : `${listing.previewImageUrls.length} screenshots but only ${distinct} distinct; rule 2.3 needs two.`,
      field: "previewImageUrls",
    },
  ];
}
