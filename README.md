# Info Export for DEF CON 33

> Export DEF CON conference data from Firebase for use on [info.defcon.org](https://info.defcon.org)  
> Brought to you by the Hacker Tracker team.

---

## Overview

This Node.js script pulls **events**, **speakers**, and **tags** from a Firebase project, processes them into structured JSON files, and outputs them for use in powering the DEF CON schedule site.

By default, it:

1. Fetches raw data from Firestore under `conferences/DEFCON33/…`
2. Writes to:
   - `out/ht/events.json`
   - `out/ht/speakers.json`
   - `out/ht/tags.json`
   - `out/ht/schedule.json` — grouped by day
   - `out/ht/people.json` — enriched speaker data
3. Applies basic processing:
   - Groups events by day
   - Flattens speaker and event associations

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- Access to a Firebase project with a `conferences/DEFCON33` collection and subcollections:
  - `events`
  - `speakers`
  - `tagtypes`

---

## Installation

```bash
git clone https://github.com/junctor/info-export.git
cd info-export
npm install
```

---

## Usage

To run the export with default settings:

```bash
npm run export
```

This will:

- Connect to the Firebase project configured in `src/config.js`
- Export data for `DEFCON33`
- Write output files to `./out/ht`

---

## Output Files

| File            | Description                                      |
| --------------- | ------------------------------------------------ |
| `events.json`   | Raw event data from Firebase                     |
| `speakers.json` | Raw speaker data                                 |
| `tags.json`     | Raw tag groups                                   |
| `schedule.json` | Events grouped by day, with simplified structure |
| `people.json`   | Flattened speaker + event references             |

---

## License

MIT
