# Info Export / Derived Data Pipeline

Export DEF CON conference data from Firestore, normalize it into deterministic JSON artifacts, and ship a client-friendly dataset optimized for IndexedDB-first consumption. This pipeline exists to make frontend clients fast and reliable by precomputing joins, indexes, and UI-ready views on the server side.

The tradeoff is deliberate: we spend more time during export to avoid runtime joins, scans, and costly data shaping on the client. That keeps network payloads small and predictable, and it makes client behavior deterministic across platforms.

High-level flow:

Firestore -> derived entities/indexes/views -> client IndexedDB (raw JSON is optional for debugging/auditing)

Explicit goals:
- correctness and referential integrity
- minimal network payloads
- offloading expensive work from the client
- deterministic builds with stable ordering and stable JSON key sorting

## Design Principles

- Canonical entities vs views
  - Entities are the authoritative, normalized records.
  - Views are pre-shaped, UI-ready projections that avoid runtime joins.
- `{ allIds, byId }` maps for O(1) access
  - Clients can fetch any record in constant time without scanning arrays.
- Precomputed indexes
  - Common queries (day, location, tag, person) are computed once in the exporter.
- Timezone correctness
  - All schedule bucketing uses `htConf.timezone` so day/minute keys match local event time.
- Minimal payload philosophy
  - Prefer IDs over embedded objects; include strings only when they are directly needed by UI.
- Logic lives in the exporter
  - The client should not have to reason about Firestore shapes or perform joins/scans.

## Directory Structure

```
out/ht/<conference>/
  manifest.json
  entities/
  indexes/
  views/
  raw/ (only when --emit-raw is enabled)
```

Production artifacts live at the conference root (`manifest.json`, `entities/`, `indexes/`, `views/`); `raw/` is optional debug/audit output behind `--emit-raw`. Production artifacts are normalized for size; raw (when emitted) is unmodified.

- `raw/` (optional)
  - Firestore snapshots written as JSON for debugging and auditing.
  - Emitted only when `--emit-raw` is used.
  - Includes `conference.json` plus all source collections:
    `articles`, `content`, `documents`, `events`, `locations`, `menus`,
    `organizations`, `speakers`, `tagtypes`.
- `manifest.json`
  - Build manifest used for cache invalidation (see Manifest & Versioning).
- `entities/`
  - Canonical, normalized stores intended for IndexedDB.
- `indexes/`
  - Precomputed query accelerators keyed by day/minute/location/person/tag.
- `views/`
  - UI-specific, render-ready models (minimal schedule view models, etc.).

## Entity Model Contract

Every entity file follows the same contract:

```json
{
  "allIds": [123, 456],
  "byId": {
    "123": { "id": 123, "...": "..." },
    "456": { "id": 456, "...": "..." }
  }
}
```

Why it is used:
- Deterministic ordering via `allIds`.
- O(1) access via `byId`.
- Simple IndexedDB storage and lookup.

Canonical entities:
- `entities/events.json`
  - The authoritative event model and the join target for schedule/details.

## View Contracts

Views are intentionally minimal and UI-specific. Unless otherwise noted, they are arrays (not `{ allIds, byId }` maps).

- `views/eventCardsById.json` (schedule)
  - Shape: `{ [eventId]: EventCard }` (byId map only)
  - EventCard fields: `id`, `content_id`, `begin`, `end`, `title`, `color`, `location`, `speakers`, `tags`
  - `tags`: `{ id, label, color_background, color_foreground }[]`
- `views/organizationsCards.json`
  - Array of `{ id, name, logoUrl? }` (logoUrl omitted when missing)
- `views/peopleCards.json`
  - Array of `{ id, name, affiliations }`
  - `affiliations` is a string array of organization names
- `views/tagTypesBrowse.json`
  - Array of `{ id, label, category, sort_order, tags }`
  - `tags`: `{ id, label, color_background, color_foreground, sort_order }[]`
  - Only includes tag types where `is_browsable == true`, `category == "content"`, and `tags.length > 0`
- `views/documentsList.json`
  - Array of `{ id, title_text, updatedAtMs }` (no `body_text`)
- `views/contentCards.json`
  - Array of `{ id, title, tags }`
  - `tags`: `{ id, label, color_background, color_foreground }[]`

## Indexes

Indexes are maps from a key to a list of event/content IDs. They are sorted by event start time (or ID where appropriate) for stable client rendering.

- `eventsByDay`
  - Key: `YYYY-MM-DD` (conference timezone)
  - Solves: day-based schedule grouping without scanning all events.
- `eventsByStartMinute`
  - Key: `YYYY-MM-DDTHH:MM` (conference timezone)
  - Solves: minute-precision schedules and timelines.
  - This is the minute-bucket equivalent of an epoch-minute index; add one only if a client actually needs numeric minute keys.
- `eventsByLocation`
  - Key: `location_id`
  - Solves: room-based schedules and filters.
- `eventsByPerson`
  - Key: `person_id`
  - Solves: speaker/person pages and filters.
- `eventsByTag`
  - Key: `tag_id`
  - Solves: tag-based filters and tag landing pages.
- `contentByTag` (if present in content)
  - Key: `tag_id`
  - Solves: tagged content filtering without scanning all content.

The client should never recompute these indexes. They are part of the contract and kept stable by the exporter.

## Manifest & Versioning

`manifest.json` contains:
- `code`: conference code
- `name`: display name
- `timezone`: IANA timezone string
- `buildTimestamp`: the build-time timestamp (UTC)

`buildTimestamp` is generated at export time and is intentionally timestamp-based (not a hash) to keep clients simple. If the timestamp changes, clients should invalidate and reload all derived artifacts. It is expected to change on every export run.

## Client Consumption (IndexedDB-First)

Expected client behavior:

1. Fetch `manifest.json` on page load.
2. Compare `buildTimestamp` to the version stored in IndexedDB.
3. If changed (or missing locally):
   - download `entities/*`, `indexes/*`, `views/*`
   - store each file as an IndexedDB object store
4. Use IndexedDB for all queries thereafter.

Typical queries:
- Schedule view
  - Read `indexes/eventsByDay[YYYY-MM-DD]`, then dereference IDs from `entities/events.byId` and/or `views/eventCardsById`.
- Event detail
  - Lookup in `entities/events.byId` by event ID, join as needed with `entities/locations`, `entities/people`, `entities/content`.
- Tag/person filters
  - Use `indexes/eventsByTag[tagId]` or `indexes/eventsByPerson[personId]` and resolve IDs from entities/views.

## Correctness Guarantees

The exporter guarantees:
- All references are validated and missing refs are counted.
- Missing or invalid references are handled deterministically (filtered out during entity build).
- Stable ordering for entities and indexes.
- Timezone-correct day/minute keys using `htConf.timezone`.
- Warnings emitted for bad data (missing refs, invalid dates, invalid timezone).
- Warnings are informational and do not fail the export.

## Running the Pipeline

Prerequisites:
- Node.js >= 18
- Firebase config in `src/config.js`

Run a local export:

```bash
npm install
npm run export -- DEFCON33
```

CLI options:

```bash
npm run export -- --conf DEFCON33 --out ./out/ht --emit-raw
```

Outputs are written to:
- `out/ht/<conference>/` (conference code is lowercased)
- `out/ht/<conference>/raw/` only when raw emission is enabled

Raw outputs are optional now because the website consumes derived artifacts only.
Enable raw snapshots when debugging or auditing:

```bash
npm run export -- --emit-raw DEFCON33
```

The `--emit-raw` flag (or `-r`) writes:
- `out/ht/<conference>/raw/conference.json`
- `out/ht/<conference>/raw/{articles,content,documents,events,locations,menus,organizations,speakers,tagtypes}.json`

Migration note: older builds wrote production artifacts under `out/ht/<conference>/derived/`.

Typical runtime characteristics:
- Fetches all collections in parallel.
- Deterministic writes via stable key ordering.
- Large datasets will primarily be bound by Firestore read time.

## Extending the Pipeline

Add a new entity:
1. Fetch the new collection in `src/conf.js`.
2. Normalize it in `src/build/entities.js`.
3. Emit a new `entities/<name>.json` file.

Add a new index:
1. Implement the index in `src/build/indexes.js`.
2. Keep keys minimal and values ID-only.
3. Sort deterministically (by start time or ID).

Add a new view:
- Use `src/build/views.js` for UI-ready models.
- Prefer a view when the UI needs a trimmed, pre-joined shape.
- Extend an entity only when the data is truly canonical.

Payload discipline:
- Prefer IDs over embedded objects.
- Avoid denormalized copies of large text.
- Keep view models minimal and UI-specific.

Common mistakes to avoid:
- Over-denormalizing entities (bloats payloads and breaks cache invalidation).
- Recomputing indexes on the client (wastes CPU and risks divergence).
- Using local time for schedule bucketing (must use `htConf.timezone`).

## Non-Goals

This pipeline does NOT try to provide:
- partial updates or incremental diffs
- fine-grained patching or merge logic
- client-side joins as a primary mechanism
- runtime schedule computation or grouping

## Release Checklist

1. Run export: `npm run export -- --conf <CONF>`
2. Publish artifacts from `out/ht/<conf>/`
