# Rationale: decisions behind the moderation rules

Companion to `moderation-plan.md` (the how). This is the why, written so each decision can be
challenged on its own. Every decision here is a first pass and marked **revisit** where the
candidate has asked to come back to it.

## 1. Severity scheme — **revisit**

Chosen scheme: **mechanical = fix**. The test is "can the developer correct this without anyone
exercising judgement?" If yes, `fix`. If a human has to decide something, `warn`. If the listing
cannot go live regardless of what the developer changes about the finding itself, `reject`.

| Rule | Severity | Why this, and what argues against it |
|---|---|---|
| 1.6 Platforms | `reject` | Naming a competitor is a content bar, not a defect. The doc puts it first in "Common rejection reasons". Against: a developer could just delete the word, so it is arguably mechanical. Kept `reject` because the intent (promoting elsewhere) is what we object to, not the string. |
| 2.1 Placeholder | `fix` | Delete `TODO`, fill in highlights. Nothing to judge. Against: §2.1 says the listing "is not ready for review" — one could argue that means bounce it. |
| 2.3 Screenshots | `fix` | Shipped this way in the worked example; the boilerplate's own reasoning holds. |
| 3.3 Pricing | `fix` | Correct the number or the copy. Against: an *active* plan at $550 cannot be sold; that is closer to `reject`. Worth splitting sub-checks if the moderator screen shows too many `fix`. |
| 4.2 Originality | `warn` | §4.2: "a human decides which of them was first." The tool cannot tell original from copy, so it must not reject either. |
| 6.2 URL | `fix` | The developer fixes the URL; no judgement. Against: §6.2 literally says "We reject a listing when the URL…". This is the weakest call in the table and the one most likely to flip. |

Why not the doc-literal scheme (6.2 and 1.6 `reject`)? It is defensible and arguably closer to
the doc. `fix` was chosen first because it produces a queue where `reject` means "a person must
say no", which is the scarce action. That can be re-argued once the queue counts are visible.

## 2. Copy scope: six fields, not pricing-plan copy

§1.6 says "every piece of copy a user can read before opening the app" and then enumerates:
name, tagline, description, description title and body, highlights. Plan name/description/
highlights are not in that list. Read the sentence as introducing the list, not extending it.
Zero fixture impact either way; the narrower reading is the one the doc actually spells out.

## 3. 1.6 matching: token windows, not collapsed-string search

Three approaches were measured against all 2,011 listings:

- Collapse to alphanumerics, substring search: catches everything, but `fans` alone appears in
  778 listings, so any slip in the canonical list is catastrophic.
- Collapse, then require word boundaries: zero hits. `"your 0nlyFans and"` collapses to
  `...youronlyfansand...`, so the boundary never exists.
- Leet-fold, split on non-alphanumerics, join 1–3 adjacent tokens, compare to the six canonical
  names: 66 hits (Audience Boost + the 65 seeded generated listings), zero false positives.

Third one chosen. Known gap: a legitimate sentence like "just for fans of…" would collapse to
`justforfans`. Not present in the data; accepted as the price of catching `Just For Fans`.

## 4. 3.3: exact cents, withdrawn plans, currency

- **Exact match.** "from $5" means a plan costs exactly 500¢. Treating it as a lower bound
  would let the generated `From $4.50 a month` listings match their $7.99 plan and never fire.
  §3.3 wording supports exact: "a plan must actually cost that."
- **Withdrawn plans are range-checked but do not satisfy copy.** A $650 withdrawn plan is still
  wrong data on the listing. But a withdrawn plan is "not purchasable" (`pricing-plans.md`
  lifecycle table), so it cannot be the plan a quoted price refers to. `pending_setup` counts as
  purchasable because it "activates automatically when your app is approved."
- **USD only.** `$` and `USD` are the only currency tokens parsed. Every fixture plan is USD.
  Other currencies would need a plan-currency comparison; out of scope until the data has one.

## 5. 4.2: threshold 0.5, own name only

- Metric: 3-word-shingle Jaccard on `description + descriptionBody`, lowercased, punctuation
  stripped, the listing's own name removed.
- The Copilot pair scores 0.90. The closest generated pair scores 0.33 (shared outcome clause).
  The closest other named pair scores 0.013. 0.5 sits in the middle of that window; 0.4 would
  start brushing generated noise, 0.7 would only catch near-verbatim copies.
- Own name only. Also stripping the *other* listing's name removes shared words (`copilot`,
  `creator`) and drops the pair to 0.76 — it makes real duplicates look less alike.
- Brute-force pairwise (~2s over 2,011) accepted for this exercise. Production answer: exact-match
  bucket first, then MinHash/LSH candidates.

## 6. 6.2: suffix match, one issue per bullet

- `fanvue.com` test is `host === "fanvue.com" || host.endsWith(".fanvue.com")`, never
  `includes("fanvue")`. §6.2: "A domain that merely has our name inside it is fine."
- One Issue per failing bullet. LinkPulse gets both `not_https` and `parking_host`; the moderator
  sees both reasons, and the spec only checks the set of rule numbers.
- `url.hostname` rather than `url.host` so a port cannot break the suffix checks.
- `localhost` is not rejected: the doc lists what to reject and it is not on the list.

## 7. Queue: `null` means passed

Once rules run over every listing, a row with no findings has been checked and passed. There is
no "unchecked" state in this system, so the queue shows "Passed" rather than "Not checked".
Rows sort `reject → fix → warn → passed`, stable within a band, and the header shows counts per
band so the moderator sees the shape of the backlog before scrolling.

## Open items to revisit

1. 6.2 `fix` vs `reject` (doc wording says reject).
2. 3.3 range violation on an *active* plan: `fix` or `reject`?
3. Whether 1.6 should `warn` instead of `reject` on disguised forms only, since the disguise is
   itself evidence of intent — or the opposite, that plain `Patreon` in a "we cross-post to" sentence
   is the weaker case.
4. Filters and per-rule drill-down on the queue (deferred from this pass).
