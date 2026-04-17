# E0-02 — USPTO TESS Brand Check: Findings

**Date:** 2026-04-17
**Investigator:** Claude (agent-driven research); human sign-off pending.
**Brand under evaluation:** "28 AND THREE" — sports analytics web application covering New England Patriots statistics.
**Relevant trademark classes:** 041 (entertainment/education services — online publications, statistical information) and 009 (downloadable software, mobile apps).

---

## 1. Methodology and its limits

The USPTO Trademark Search system at `tmsearch.uspto.gov` is a JavaScript single-page application and cannot be scraped non-interactively. Evidence was gathered by:

1. **Indirect USPTO index via web search** (Google). The USPTO publishes records that are indexed by general search engines. A zero-result Google search for an exact-quoted trademark phrase is a strong (not conclusive) signal that no registered or pending mark exists under that phrasing.
2. **Third-party trademark aggregators.** Trademarkia and Justia both publish scraped USPTO records. Justia and Trademarkia direct queries were blocked by 403 on this run, but their records still appear in Google indexes and can be inferred from the zero-result searches.
3. **Expert-curated lists.** Gerben Law's comprehensive index of New England Patriots trademarks was reviewed.
4. **Market surface scan.** Searched for commercial use of the target phrase across Patriots fan merchandise and sports analytics spaces.

**What this method cannot detect:**
- Pending applications filed in roughly the last 3–6 months that are not yet indexed.
- Phonetic-equivalent matches the USPTO TESS `phonetic` qualifier would surface (e.g., numerals/spelling variants Google misses).
- Abandoned / dead applications suppressed from top-line search results.

**What it can detect with high confidence:**
- Any live registered mark under these phrasings — such marks would appear prominently.
- Any widely used common-law usage in the same trade channel.

For legal-weight certainty, the human step described in Section 5 must be performed. The findings below establish that the expected outcome is GO, and the residual risk is low.

---

## 2. Required searches and results

Per `/docs/preflight.md`, the five required searches are listed below. Each row records the query, result summary, and evidence source.

| # | Query | Scope | Result | Evidence |
|---|---|---|---|---|
| 1 | `"28 AND THREE"` | Exact phrase, all classes | **No matching trademark records.** General web search returns zero trademark-aggregator or USPTO hits for this exact phrase. | Google: zero links. |
| 2 | `"28 AND 3"` or `"28 and 3"` | Exact phrase, all classes | **No matching trademark records.** Extensive use of "28-3" as a Patriots merchandise slogan (see §3), but no registered mark under this phrasing. | Google: results are only about the Super Bowl LI score; no trademark database hits. |
| 3 | `"28-3"` | Exact phrase, all classes, with focus on class 041/009 | **No matching registered trademark records** in analytics / software / entertainment-service classes. Extensive common-law use in apparel (Class 025) as an un-registered score slogan. | Google + Gerben Law Patriots trademark index: zero hits. |
| 4 | `"TWENTY EIGHT AND THREE"` | Exact phrase, all classes | **No matching trademark records.** | Google: zero links. |
| 5 | Phonetic equivalents, class 041 (via TESS `phonetic` qualifier — cannot be simulated externally) | Class 041 | **Indirect signal negative.** Comprehensive Patriots trademark index (Gerben Law, 50 entries) returns no "28", "THREE", "COMEBACK", "SB LI", or related marks. Extended web search for sports-analytics marks in class 041 with numeric-prefix patterns returned nothing comparable. | Gerben Law NEP trademark index reviewed. |

---

## 3. Key supporting findings

### 3.1 Common-law "28-3" usage is merch-only and in a different trademark class

Multiple retailers sell "28-3" Patriots-comeback apparel:

- `patspropaganda.com` — claims to be "the original place for the 28-3 / 34-28 tee." No USPTO trademark registered under "28-3" or "Pats Propaganda" per searches.
- `617apparel.com` — Patriots-themed apparel including "28-3" scoreboard shirts.
- `homage.com` — Patriots SB LI champion apparel.
- `redbubble.com` — user-generated "28-3" designs.
- `fanfavorite.com` — "28-3" stickers.

All of these operate in **International Class 025 (clothing/apparel)** or Class 016 (paper/stickers). The target brand "28 AND THREE" operates in Classes 041 (entertainment/information services) and 009 (downloadable software). Under standard likelihood-of-confusion analysis, different classes + different channels of trade + different commercial impression (a phrase-as-brand vs. a score-as-slogan on a T-shirt) substantially reduce conflict risk.

### 3.2 No NFL / Patriots / Falcons trademark claim on "28-3" or variants

- **New England Patriots LLC** owns 46–50 registered trademarks per Gerben Law's index (including `DO YOUR JOB`, `IGNORE THE NOISE`, `NO DAYS OFF`, `THE PATRIOT WAY`). **None reference 28, 28-3, THREE, COMEBACK, or SB LI.**
- **Atlanta Falcons** posted and then rapidly deleted a 2025 social-media reference to "28-3," which would be unusual behavior from a rights holder — implying no defensive registration.
- **NFL Properties** holds `SUPER BOWL` and related marks, but no "28-3" or comeback-themed marks were surfaced in research.

### 3.3 The phrase "28 AND THREE" itself appears to be unused commercially

Web search for the exact phrase, the domain variants (`28andthree.com`, `28and3.com`), and bracketed variants returns zero commercial or brand results. This is consistent with a genuinely available namespace.

---

## 4. Preliminary recommendation: **PRELIMINARY GO**

Based on all evidence gathered:

- **No registered trademark** blocks the name "28 AND THREE" in Class 041 or Class 009.
- **No pending application** surfaced for this name in any class.
- **Common-law usage** of "28-3" exists only in the apparel (Class 025) channel, as a score-on-a-shirt slogan. This does not reach into online statistical information / software services.
- **No NFL or Patriots mark** exists that we would be plausibly perceived as infringing.
- The phrase "28 AND THREE" is a natural-language expression of the 28-3 score; it is arguably descriptive of the comeback narrative, which can be a mild registrability concern — but does not block commercial use, only affects how strong a future registration we could obtain.

**Residual risks:**

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Pending application filed in the last 3–6 months not yet indexed by Google | Low | High if it lands in Class 041 | Human confirmation in §5 below catches this. |
| Common-law "28-3" apparel sellers claim confusion | Low | Low (different class, different channel) | Keep branding distinct from "28-3" in visual treatment; prefer the spelled-out phrase "28 AND THREE" over the numeric "28-3" as the primary wordmark. |
| NFL sends a nastygram despite no registered mark | Low-Medium | Medium (delay) | Use clear disclaimer (§ SPEC.md legal). Never use Patriots logos, trade dress, or official team iconography. Frame as "fan-run statistical information service." |
| Phonetic-equivalent mark exists that Google missed | Very Low | Medium | Human TESS search with `phonetic` qualifier (§5). |

**Escalation path if residual risk fires:** `/docs/escalation.md` Scenario 1 — $500 pre-authorized counsel consult.

---

## 5. Human action required to convert PRELIMINARY GO → PASS

The automated research above is strong evidence but does not satisfy the `PDF archive to /docs/preflight/e0-02/` evidence requirement in preflight.md. To close the task, the human operator must:

1. **Open `https://tmsearch.uspto.gov/` in a browser.**
2. **Run each of the five searches below and save the results page as PDF to `/docs/preflight/e0-02/`:**
   - `"28 AND THREE"` — all classes, any status. Filename: `search-1-28-and-three.pdf`.
   - `"28 AND 3"` — all classes, any status. Filename: `search-2-28-and-3.pdf`.
   - `"28-3"` — all classes, any status. Filename: `search-3-28-dash-3.pdf`.
   - `"TWENTY EIGHT AND THREE"` — all classes, any status. Filename: `search-4-twenty-eight-and-three.pdf`.
   - Phonetic-equivalent search, class 041 (use the Field tag builder; search `*28*3*` or similar pattern with phonetic operator). Filename: `search-5-phonetic-class-041.pdf`.
3. **If any search returns a live or pending registration in class 041 or 009 that could plausibly conflict:** STOP. Invoke `/docs/escalation.md` Scenario 1 and consult counsel before proceeding.
4. **If all five searches return clean (as expected from this research):** Mark E0-02 `Status: PASS` in `/docs/preflight.md`, record the date, link this findings file + the five PDFs as evidence.

Estimated time for the human step: 15–25 minutes.

---

## 6. Conclusion

Automated research produced **zero evidence** of a blocking trademark for "28 AND THREE" across registered, pending, and common-law commercial channels relevant to this project (Class 041 and Class 009). The common-law use of "28-3" in Patriots fan apparel (Class 025) is thematically adjacent but does not legally or practically block a sports analytics information service. The expected outcome of the required human USPTO session is PASS.

The task should not be marked PASS until the human session completes and the PDF evidence is archived.
