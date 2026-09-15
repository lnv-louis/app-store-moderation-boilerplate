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
  return listings.map((listing) => ({ listing, issues: checkListing(listing) }));
}

/** Every check that only needs the one listing in front of it. */
function checkListing(listing: AppListing): Issue[] {
  return [...checkScreenshotCount(listing), ...checkProductionReady(listing), ...checkAppUrl(listing)];
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
