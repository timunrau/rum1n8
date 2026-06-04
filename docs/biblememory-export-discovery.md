# BibleMemory Export Discovery Report

## Summary

Discovery was performed on June 3, 2026 from public pages, static Next.js bundles, unauthenticated API probes, and a logged-in Chrome DevTools MCP session. I did not collect credentials, cookies, raw verse text, or raw private identifiers in this report; logged-in inspection returned only sanitized shapes, counts, and redacted IDs.

Best current route: API-based bookmarklet MVP, with Chrome extension as fallback if logged-in testing shows collection traversal or pagination is brittle.

The strongest extraction surface is verified same-origin JSON:

- `/api/myverses/collections`
- `/api/collection/{categoryGuid}?page=1&pageSize=200&sort=custom`
- `/api/review`

The current Ruminate importer does not read a `Collection` CSV column yet. A BibleMemory exporter can generate it, but preserving memberships requires adding Collection handling to Ruminate import. Also, the current Ruminate CSV parser splits input on newlines before parsing quoted fields, so multiline BibleMemory verse text needs a more robust CSV parser before this is production-safe.

## App Architecture Findings

- Rendering model: mixed, but logged-in verse data is client-loaded. The `/myverses` server HTML renders a Next.js app shell and "Loading your verses..." state.
- Main pages involved: `/myverses`, `/collection/{categoryGuid}`, `/review`, `/memorize/{memoryVerseGuid}`, `/scripturecards?categoryGuid=...`.
- Full page reloads? Collection and memorize links are normal URL navigations; the React app also uses client routing.
- Single-page navigation? Partial. Next.js app shell and client components are used, but collection links are URL-addressable.
- Data source: authenticated same-origin JSON endpoints verified from page context.
- Best extraction surface: `/api/myverses/collections` for collection discovery, then `/api/collection/{categoryGuid}` with pagination for verse records and collection membership.
- Known limitations: review interval is exposed as a BibleMemory bucket, not guaranteed to be BibleMemory's full hidden scheduler state; Ruminate importer currently ignores Collection and is fragile for quoted newlines.

## Network Findings

### Request

- URL path: `/api/myverses/collections`
- Method: `GET`
- Query params: none observed
- Request body shape: none
- Response content type: `application/json`
- Requires cookies/session? yes
- Returns JSON? yes
- Contains verse reference? no, inferred collection summary only
- Contains verse text? no
- Contains translation/version? no
- Contains collections? yes
- Contains progress? collection-level summary only, inferred fields include `verseCount`, `masteredVerseCount`, `minPriority`
- Contains next review date? partial, via collection `minPriority`
- Contains interval/frequency? no
- Pagination? no
- Rate limiting observed? no
- Notes: logged out response was `401 {"error":"Unauthorized"}`.
- Logged-in verification: returned status 200 with top-level keys `collections`, `masterList`, `totalVerseCount`. Test account summary showed 15 top-level collections and `totalVerseCount=326`.

### Request

- URL path: `/api/collection/{categoryGuid}`
- Method: `GET`
- Query params: `page`, `pageSize`, `sort`, optional `search`
- Request body shape: none
- Response content type: `application/json`
- Requires cookies/session? yes
- Returns JSON? yes
- Contains verse reference? yes, inferred `verses[].reference`
- Contains verse text? yes, inferred `verses[].verseText`
- Contains translation/version? yes, inferred `verses[].abbreviation` and `verses[].translation`
- Contains collections? yes, current collection plus `subcollections`
- Contains progress? yes, verified `memorized`, `currentBucket`, `maxBucket`, `successCount`, `priority`
- Contains next review date? yes, verified `nextReviewOn` string
- Contains interval/frequency? partial, `currentBucket`
- Pagination? yes, `pageSize` is 200 in current UI
- Rate limiting observed? no
- Notes: best export endpoint candidate. Logged-in first collection response returned top-level keys `collection`, `subcollections`, `verses`, `totalVerseCount`, `versePagination`, `isSequential`, `maxBucket`; first verse shape included `memoryVerseGuid`, `reference`, `refBook`, `refChapter`, `refVerseStart`, `refVerseEnd`, `verseText`, `memorized`, `currentBucket`, `maxBucket`, `verseAudioRecorded`, `successCount`, `nextReviewOn`, `priority`, `abbreviation`, `categoryDisplayIndex`.

### Request

- URL path: `/api/myverses/verses`
- Method: `GET`
- Query params: `search`
- Request body shape: none
- Response content type: `application/json`
- Requires cookies/session? yes
- Returns JSON? yes
- Contains verse reference? yes
- Contains verse text? yes
- Contains translation/version? yes
- Contains collections? unclear
- Contains progress? yes
- Contains next review date? partial
- Contains interval/frequency? partial
- Pagination? unclear
- Rate limiting observed? no
- Notes: useful for search, but not enough as the primary full export route unless a blank search returns all verses.

### Request

- URL path: `/api/review`
- Method: `GET`
- Query params: optional `categoryGuid`
- Request body shape: none
- Response content type: `application/json`
- Requires cookies/session? yes
- Returns JSON? yes
- Contains verse reference? yes
- Contains verse text? no, inferred from UI use
- Contains translation/version? yes, inferred `abbreviation`
- Contains collections? no, category filter only
- Contains progress? yes, `currentBucket`, `maxBucket`, `locked`
- Contains next review date? yes, verified `nextReviewOn`; also `dueLabel`/`dueVariant`
- Contains interval/frequency? yes, bucket
- Pagination? not observed
- Rate limiting observed? no
- Notes: useful review-progress cross-check. Logged-in response included top-level keys `verses`, `dailyLimit`, `reviewedTodayCount`, `sections`, `reviewAllStartSection`, `dueCount`, `maxBucket`; first review verse also included `verseText`, `lastMemorizedOn`, `nextReviewOn`, `dueLabel`, `locked`, and passage grouping keys.

- Best endpoint candidate: `/api/collection/{categoryGuid}?page=...&pageSize=200&sort=custom`
- Can be called from page context? yes, inferred from first-party client code; use `fetch(path, { credentials: "include" })`
- Requires CSRF token? no CSRF token observed for GET endpoints; PATCH/POST endpoints do use JSON bodies but are not needed for export
- Supports all collections? likely yes through `/api/myverses/collections` and `subcollections`
- Supports all needed progress data? mostly; exposes `nextReviewOn` and frequency bucket, but not necessarily BibleMemory's full hidden scheduler state
- Recommended extraction method: API bookmarklet that fetches collections, traverses collection pages, emits repeated rows per collection membership, and optionally calls `/api/review` to enrich progress.

## DOM Findings

- Current page extraction possible? partial
- Stable selectors: semantic URL patterns are stronger than CSS selectors: `/collection/{categoryGuid}`, `/memorize/{memoryVerseGuid}`, `/review?categoryGuid=...`
- Fragile selectors: CSS module classes such as `page-module__pSF14a__verseRow`, `page-module__T1NA3q__verseRow`, `ScriptureTyper-module__KJMaKq__rvCell`
- Pagination/lazy-loading behavior: collection pages request `pageSize=200` and render pagination when total count exceeds page size
- Fields visible in DOM: reference, translation abbreviation, verse text preview, due/frequency labels, collection names
- Fields missing from DOM: full account-wide collection membership from a single screen, exact review interval in days, exact next review date unless visible on memorize/review views
- Notes: DOM extraction is viable only as a fallback. CSS module selectors are build-generated and may change.

Proof-of-concept visible-page snippet:

```js
const records = [...document.querySelectorAll('a[href^="/memorize/"]')].map((el) => ({
  reference: el.querySelector('[class*="verseReference"]')?.textContent?.trim() || '',
  content: el.querySelector('[class*="verseText"]')?.textContent?.trim() || '',
  version: el.querySelector('[class*="translationBadge"]')?.textContent?.trim() || '',
  collection: document.querySelector('h1')?.textContent?.trim() || '',
  daysUntilNextReview: '',
  interval: ''
}));
console.log(records);
```

## Collection Findings

- Collection list available? yes, via `/api/myverses/collections`
- Collection IDs available? yes, `categoryGuid`
- Collection URLs available? yes, `/collection/{categoryGuid}`
- Verse-to-collection membership available? partial/yes by fetching each collection page
- Multiple collection membership supported? yes. The user manual says editing a verse can assign it to a new or existing collection, and logged-in traversal found 1 verse ID appearing in more than one collection.
- Best way to export all collections: fetch all collections, recursively fetch subcollections, then fetch every page of each collection endpoint. In the logged-in test account, traversal found 15 top-level collections, 7 subcollections, 22 collections total, 22 collection pages fetched, 220 membership rows, 219 unique memory verse IDs, and 1 duplicate membership.
- Bookmarklet feasibility: viable for MVP if logged-in testing confirms response shapes.
- Extension feasibility: stronger for guided traversal, progress UI, retries, and future UI/API churn.
- Deleting a collection leaves verses intact? official manual says verses remain in the verse list when a collection is deleted.

## Review Progress Findings

- Next review data available? yes. Collection and review endpoints include `nextReviewOn`; collection UI also uses numeric `priority`/`minPriority` to render due labels.
- Interval/frequency available? partial. `currentBucket` maps to labels: Daily, Every 2 Days, Weekly, Monthly, etc.
- Progress status available? yes, `memorized`, `currentBucket`, `maxBucket`, collection `masteredVerseCount`
- Best data source: collection endpoint for export rows, review endpoint for due-state cross-check
- Proposed mapping to Ruminate: compute `DaysUntilNextReview` from `nextReviewOn` relative to export date, clamped to 0 for overdue; map `currentBucket` to day intervals where defensible; use `priority` only as fallback
- Fields that cannot be mapped: hidden spaced-repetition state and any nuance behind BibleMemory's bucket advancement/locking algorithm

## Recommended CSV Format

- Recommended columns: `Reference,Content,Version,Collection,DaysUntilNextReview,Interval,Source,SourceId,ExportedAt`
- Required columns: `Reference,Content`
- Optional columns: `Version,Collection,DaysUntilNextReview,Interval,Source,SourceId,ExportedAt`
- Repeated-row collection strategy: one row per verse per collection membership; deduplicate in Ruminate by `Reference + Version + Content`
- Example output:

```csv
Reference,Content,Version,Collection,DaysUntilNextReview,Interval,Source,SourceId,ExportedAt
John 3:16,"For God so loved the world...",NIV,Salvation,45,60,BibleMemory,abc-123,2026-06-03T23:35:00.000Z
Romans 8:28,"And we know that in all things...",ESV,Encouragement,30,60,BibleMemory,def-456,2026-06-03T23:35:00.000Z
```

For the first production exporter aimed at today’s Ruminate importer, use the baseline headers:

```csv
Reference,Content,Version,Collection,DaysUntilNextReview,Interval
```

Then update Ruminate import to consume `Collection`; otherwise that column will be ignored. Also replace the current line-splitting CSV parser before relying on exported BibleMemory content with embedded newlines.

## Bookmarklet Feasibility

| Strategy | Feasibility | Reliability | User Friendliness | Risk | Recommendation |
|---|---:|---:|---:|---:|---|
| API bookmarklet | High | Medium/high | High | Low/medium | Recommended |
| DOM bookmarklet | Medium | Low/medium | Medium | Medium | Viable only as fallback |
| Assisted bookmarklet | High | Medium | Medium/low | Low | Viable for MVP fallback |
| iframe crawler | Medium | Medium | Medium | Medium | Not recommended unless API blocks background fetch |

API bookmarklet is the right MVP candidate because the app already calls same-origin JSON endpoints from page context, the endpoints require the user’s own session cookie, and logged-in MCP verification confirmed the needed fields.

## Chrome Extension Feasibility

- Does extension materially improve export reliability? yes for nontechnical users and multi-page coordination, but not strictly needed for API export
- Specific capabilities needed: persistent state across navigations, retries, progress UI, local CSV download
- Permissions needed: `host_permissions: ["https://biblememory.com/*"]`, `downloads`, `storage`, `activeTab`, `scripting`
- Can it avoid Chrome Web Store during beta? yes, through local sideloading; public release would need store/distribution work
- Is bookmarklet still viable? yes, if API responses are stable
- Recommendation: build bookmarklet MVP first; graduate to extension if user testing shows bookmarklet install/support friction or API traversal failures.

## Decision Matrix

| Criterion | Bookmarklet | Chrome Extension |
|---|---:|---:|
| No store submission | Strong | Weak for public release, okay for sideload beta |
| User friendliness | Medium | High |
| Multi-page collection export | Medium/strong with API | Strong |
| API-based export | Strong if endpoints remain available | Strong |
| DOM-only export | Medium | Medium/strong |
| Persists across navigation | Weak | Strong |
| Local-only privacy story | Strong | Strong |
| Maintenance burden | Medium | Medium |
| Nontechnical user support | Medium/low | High |

## Final Route Recommendation

Recommended route: API-based bookmarklet MVP.

Reason: BibleMemory’s current web app exposes authenticated same-origin JSON endpoints for collections, collection verses, and review state. A bookmarklet can run entirely in the user’s logged-in browser session without collecting credentials, without server upload, and without remote scraping from Ruminate.

Fallback route: Chrome extension.

Conditions that would change the decision:

- If logged-in testing shows `/api/collection/{categoryGuid}` omits verses in multiple collections, use `/api/review` plus per-verse `/api/memorize/{memoryVerseGuid}` enrichment or an extension.
- If the API blocks bookmarklet-originated fetches, use an extension content script.
- If review progress is too vague, export verses and collections first and leave interval blank while preserving `nextReviewOn`-derived due timing.
- If Ruminate must preserve collections, update the Ruminate CSV importer to support `Collection` before calling the export fully compatible.

## Proof of Concept

Created bookmarklet artifacts under `scripts/biblememory-migration/`.

The POC:

- runs only on `biblememory.com`
- uses same-origin authenticated `fetch`
- fetches collection summaries
- traverses collection pages with `pageSize=200`
- exports `Reference,Content,Version,Collection,DaysUntilNextReview,Interval`
- escapes CSV values correctly
- displays a modal with verses found, collections found, rows exported, missing progress count, Download CSV, and Copy CSV

## Risks and Open Questions

- Review `currentBucket` is a frequency bucket, not guaranteed to be the exact interval BibleMemory’s scheduler uses internally.
- `priority` tracks due timing and aligns with `nextReviewOn` in verified samples, but `nextReviewOn` should be preferred.
- Ruminate importer currently needs Collection support and robust quoted-newline CSV parsing.
- BibleMemory could rename private API routes; bookmarklets have no deployment control once copied.

## Next Implementation Tasks

1. Run `scripts/biblememory-migration/bookmarklet.min.js` in the logged-in account and inspect the generated CSV.
2. Decide whether `currentBucket` should map to Ruminate `Interval` or remain blank unless exact day intervals are confirmed.
3. Add Ruminate importer support for `Collection` and repeated-row deduplication.
4. Replace Ruminate’s CSV parser with one that supports quoted commas, quotes, and embedded newlines.
5. Add a repeatable minification/generation script after the CSV output is validated.
