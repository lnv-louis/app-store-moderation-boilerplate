# Moderation rules: implementation plan

Working notes for the branch `feat/moderation-rules-and-queue`. Each rule below cites the
section of `listing-requirements.md` it implements, the deterministic approach, and the
decisions the doc leaves open. Severities are a first pass and are revisited at the end.

## Shape

`rules.ts` keeps its current shape: one pure `checkX(listing): Issue[]` per rule with a
JSDoc that quotes the doc, composed in `checkListing`. `reviewListings` stays the entry point
and additionally runs the one cross-store rule (4.2) once over the whole set.

```ts
export function reviewListings(listings) {
  const duplicates = findDuplicateDescriptions(listings); // 4.2, Issue[][] aligned to input
  return listings.map((listing, i) => ({ listing, issues: [...checkListing(listing), ...duplicates[i]] }));
}

function checkListing(listing) {
  return [
    ...checkPlatformMentions(listing), // 1.6
    ...checkProductionReady(listing),  // 2.1
    ...checkScreenshotCount(listing),  // 2.3 (worked example, unchanged)
    ...checkPricingAccuracy(listing),  // 3.3
    ...checkAppUrl(listing),           // 6.2
  ];
}
```

## Sanitisation: one helper

Three rules scan copy. They share a single normaliser so there is one place to reason about.

```ts
/** Lowercase, optionally fold leet digits to letters, and split on anything non-alphanumeric. */
function words(text: string, leet = false): string[]
```

- `leet` map: `0→o 1→l 3→e 4→a 5→s 7→t`. Only 1.6 turns it on.
- 1.6 and 2.1 match on `words(text, true).join(" ")` / token windows.
- 4.2 uses `words(text)` (no leet) after removing the listing's own name.
- 3.3 does not use it; prices need `$` and `.`, so it runs regexes on `text.toLowerCase()`.

The six copy fields §1.6 names, exposed once so each finding can point at the field at fault:

```ts
/** §1.6: "the app name, tagline, description, description title and body, and the listing highlights." */
function copyFields(l): [field: string, text: string][]
// name, tagline, description, descriptionTitle, descriptionBody, highlights[i]
```

Pricing-plan copy (plan name/description/highlights) is **not** scanned. Decision: the doc lists
six fields explicitly; the broader "every piece of copy" sentence is read as introducing that list.

## Rules

### 1.6 `checkPlatformMentions` — code `platform_mention`

§1.6: "digits standing in for letters (`0nlyFans`, `Fans1y`), separators inserted between the
words (`only.fans`, `Only Fans`, `only-fans`), or unusual casing."

- Canonical names: `onlyfans fansly patreon loyalfans manyvids justforfans`.
- Per copy field: `tokens = words(text, true)`; for every window of 1–3 adjacent tokens,
  `tokens.slice(i, j).join("")` compared against the canonical set.
- Why token windows: matching on a fully collapsed string with word boundaries misses
  `"your 0nlyFans and"`; matching without boundaries hits bare `fans` in 778 of 2,011 listings.
  Token windows flag exactly Audience Boost + 65 generated, zero false positives.
- One Issue per field hit. Message quotes the text as written and names the platform.

### 2.1 `checkProductionReady` — codes `placeholder_copy`, `empty_highlights`

§2.1: markers `lorem, ipsum, TODO, TBD, FIXME, coming soon, placeholder, sample text`;
"Empty listing highlights are the other common sign."

- Case-insensitive whole-word regex over `words(text, true).join(" ")`. Case-insensitive
  because LinkPulse has `Lorem`. Leet on because `c0ming s00n` is still a placeholder.
- One `placeholder_copy` Issue per field with a marker, `field` set.
- `empty_highlights` when `highlights.filter(h => h.trim()).length === 0`.

### 2.3 `checkScreenshotCount` — unchanged

### 3.3 `checkPricingAccuracy` — codes `plan_price_out_of_range`, `copy_price_unmatched`, `free_tier_missing`

§3.3 lists three failures. `pricing-plans.md`: price "Between $3.99 and $500.00 (paid plans)".

1. Range: every plan with `billingType !== "free"` and `price < 399 || price > 50000`.
   `field: pricingPlans[i].price`. Withdrawn plans **are** range-checked (it is still bad data).
2. Copy price: regex `/\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?usd\b/g` over lowercased
   copy → integer cents → must equal `price` of a plan whose status is `active` or
   `pending_setup`. Exact match: "from $5" means a plan at 500¢ exists, otherwise the generated
   `From $4.50 a month` listings would match their $7.99 plan and never fire.
3. Free tier: `/\bfree (plan|tier|forever|to start)\b/` in copy and no active/pending plan with
   `billingType === "free" || price === 0`.

Decisions: `$` and `USD` are the only currencies parsed (all fixtures are USD).
Withdrawn plans: range-checked, but do not satisfy a copy claim (not purchasable).

### 4.2 `findDuplicateDescriptions(listings): Issue[][]` — code `duplicate_description`

§4.2: "Compare on `description` and `descriptionBody`, ignoring case, punctuation and the app's
own name." "Two listings that match each other are both flagged."

- Normalise: `description + " " + descriptionBody`, remove the listing's **own** name as a phrase
  (case-insensitive), then `words()`. Only own name: also stripping the other listing's name drops
  the Copilot pair from 0.90 to 0.76 because it removes common words.
- 3-word shingles, Jaccard, all pairs `i < j`. Flag both members. Message names the other listing.
- Threshold **0.5**. Window on fixtures: Copilot pair 0.90; highest generated pair 0.33; highest
  other named pair 0.013.
- Cost: ~2s brute force over 2,011 at render. Acceptable for this exercise; MinHash/LSH is the
  production upgrade if asked.

### 6.2 `checkAppUrl` — one code per bullet in §6.2

`app_url_missing`, `app_url_invalid` (URL throws), `app_url_not_https`, `app_url_ip_host`,
`app_url_fanvue_domain`, `app_url_parking_host`.

- `new URL()` in try/catch; use `url.hostname` (not `host`) so ports do not break suffix checks.
- `fanvue.com`: `host === "fanvue.com" || host.endsWith(".fanvue.com")`. Suffix, not substring:
  §6.2 "A domain that merely has our name inside it is fine" (`copilot-fanvue-tools.com` passes).
- Parking hosts, same suffix test: `parkingcrew.net sedoparking.com afternic.com godaddysites.com wixsite.com`.
- IP host: IPv4 regex, or `:` in hostname (IPv6).
- One Issue per failing bullet (LinkPulse gets `not_https` + `parking_host`; spec dedupes by rule).

## Severities (first pass — revisit)

Scheme: **mechanical = fix**. Anything the developer can correct without anyone's judgement is
`fix`; findings that need a person are `warn`; hard bars are `reject`.

| Rule | Severity | Rationale |
|---|---|---|
| 1.6 | `reject` | Promoting a competitor is a content bar, not a typo. Doc lists it first under rejection reasons. |
| 2.1 | `fix` | Developer deletes the placeholder / adds highlights. No judgement needed. |
| 2.3 | `fix` | As shipped in the worked example. |
| 3.3 | `fix` | Correct the price or the copy. Mechanical. |
| 4.2 | `warn` | §4.2: "a human decides which of them was first." The tool cannot. |
| 6.2 | `fix` | Doc says "we reject", but a URL is developer-correctable without judgement. Open to `reject`; the doc's own wording argues for it. |

Open question to revisit: 6.2 `fix` vs `reject`, and whether 3.3 out-of-range on an *active* plan
should be `reject` since the plan cannot be sold as-is.

## Queue

- `worstSeverity`: first of `SEVERITY_ORDER` present, else `null`. `null` on the queue means
  "passed every automated check" now that rules run over everything.
- `sortQueue`: stable sort by severity band; no-finding rows last. Returns a new array.
- `ReviewQueue`: status column shows worst severity or "Passed"; rows sorted; header counts per
  severity so the moderator sees the shape of the backlog before scrolling.

## Test plan (`rules.test.ts`)

Per rule: one positive taken from the named fixture's trap, one negative for the red herring.

| Rule | Positive | Negative |
|---|---|---|
| 1.6 | tagline `0nlyFans`; body `Only.Fans`; `Just For Fans` | body `"the only scheduler you need"`, `"new fans"` |
| 2.1 | `Lorem ipsum`; `TODO:`; `highlights: []` | clean copy |
| 3.3 | plan 55000; copy `$2.99` with no plan; `free forever` with no free plan | `$9.99` with plan 999; withdrawn 65000 range-fires but `$14.99` copy matches active plan |
| 4.2 | two listings, identical description, body differing by one word → both flagged | two unrelated listings → none |
| 6.2 | `http://`; `fanradar.fanvue.com`; `x.parkingcrew.net`; `null`; `https://1.2.3.4` | `copilot-fanvue-tools.com`; `https://example.com:3000/path` |

## Order

6.2 → 2.1 → 1.6 → 3.3 → 4.2 → queue. One commit each.
