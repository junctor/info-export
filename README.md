# Info Export for DEF CON 33

> Export DEF CON conference data from Firebase for use on [info.defcon.org](https://info.defcon.org)

---

## Overview

This Node.js script pulls a set of sub-collections under `conferences/{conferenceCode}` from your Firebase project, writes them out as raw JSON, and then applies a couple of light transformations for schedule grouping and speaker enrichment.

By default, it:

1. Fetches raw data under `conferences/{conferenceCode}/{articles,content,documents,events,locations,menus,organizations,speakers,tagtypes}`
2. Writes to:
   - `out/ht/{conferenceCode}/conference.json` — the main conference document
   - `out/ht/{conferenceCode}/articles.json`
   - `out/ht/{conferenceCode}/content.json`
   - `out/ht/{conferenceCode}/documents.json`
   - `out/ht/{conferenceCode}/events.json`
   - `out/ht/{conferenceCode}/locations.json`
   - `out/ht/{conferenceCode}/menus.json`
   - `out/ht/{conferenceCode}/organizations.json`
   - `out/ht/{conferenceCode}/speakers.json`
   - `out/ht/{conferenceCode}/tagtypes.json`
3. Generates four “derived” files:
   - `out/ht/{conferenceCode}/schedule.json` — events grouped by day
   - `out/ht/{conferenceCode}/people.json` — speakers with embedded event references
   - `out/ht/{conferenceCode}/processedContent.json` — Content refined and enriched
   - `out/ht/{conferenceCode}/search.json` — IDs, titles, and types

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- A Firebase project containing a `conferences/{conferenceCode}` document and the above sub-collections
- A `src/config.js` (or environment variables) specifying your Firebase settings

---

## Installation

```bash
git clone https://github.com/junctor/info-export.git
cd info-export
npm install
```

---

## Configuration

Edit `src/config.js` (or set env-vars) to point at your Firebase project.

---

## Usage

Run the exporter with a conference code:

```bash
npm run export -- DEFCON33
```

By default this will:

1. Read the conference code from the first CLI argument
2. Fetch all listed collections under `conferences/{conferenceCode}`
3. Write raw JSON into `./out/ht/{conferenceCode}`
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
