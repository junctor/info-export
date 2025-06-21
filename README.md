# Info Export for DEF CON 33

> Export DEF CON conference data from Firebase for use on [info.defcon.org](https://info.defcon.org)

---

## Overview

This Node.js script pulls a set of sub-collections under `conferences/DEFCON33` from your Firebase project, writes them out as raw JSON, and then applies a couple of light transformations for schedule grouping and speaker enrichment.

By default, it:

1. Fetches raw data under `conferences/DEFCON33/{articles,content,documents,events,locations,menus,organizations,speakers,tagtypes}`
2. Writes to:
   - `out/ht/conference.json` — the main conference document
   - `out/ht/articles.json`
   - `out/ht/content.json`
   - `out/ht/documents.json`
   - `out/ht/events.json`
   - `out/ht/locations.json`
   - `out/ht/menus.json`
   - `out/ht/organizations.json`
   - `out/ht/speakers.json`
   - `out/ht/tagtypes.json`
3. Generates four “derived” files:
   - `out/ht/schedule.json` — events grouped by day
   - `out/ht/people.json` — speakers with embedded event references
   - `out/ht/processedContent.json` — Content refined and enriched
   - `out/ht/search.json` — IDs, titles, and types

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- A Firebase project containing a `conferences/DEFCON33` document and the above sub-collections
- A `src/config.js` (or environment variables) specifying your `CONFERENCE_CODE` and any other Firebase settings

---

## Installation

```bash
git clone https://github.com/junctor/info-export.git
cd info-export
npm install
```

---

## Configuration

Edit `src/config.js` (or set env-vars) to point at your Firebase project and conference code:

```js
export const CONFERENCE_CODE = "DEFCON33";
export const FIRESTORE_ROOT = ["conferences", CONFERENCE_CODE];
```

---

## Usage

Run the exporter with:

```bash
npm run export
```

By default this will:

1. Read `CONFERENCE_CODE` from your config
2. Fetch all listed collections
3. Write raw JSON into `./out/ht`
4. Produce `schedule.json` and `people.json`

---

## Output Files

| File                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `conference.json`       | The root conference document                   |
| `articles.json`         | Raw “articles” collection                      |
| `content.json`          | Raw “content” collection                       |
| `documents.json`        | Raw “documents” collection                     |
| `events.json`           | Raw “events” collection                        |
| `locations.json`        | Raw “locations” collection                     |
| `menus.json`            | Raw “menus” collection                         |
| `organizations.json`    | Raw “organizations” collection                 |
| `speakers.json`         | Raw “speakers” collection                      |
| `tagtypes.json`         | Raw “tagtypes” collection                      |
| `schedule.json`         | Events grouped by day (object keyed by date)   |
| `people.json`           | Speakers enriched with their associated events |
| `processedContent.json` | Content refined and enriched                   |
| `search.json`           | IDs, titles, and types                         |

---

## License

MIT
