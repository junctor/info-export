// src/conference.js
import fs from "fs/promises";
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import {
  createDateGroup,
  createSearchData,
  mapTagsToProcessedSchedule,
  processContentData,
  processScheduleData,
  processSpeakers,
  processContentDataById,
} from "./utils.js";

const collections = [
  "articles",
  "content",
  "documents",
  "events",
  "locations",
  "menus",
  "organizations",
  "speakers",
  "tagtypes",
];

export default async function conference(db, outBaseDir, conferenceCode) {
  const outputDir = path.join(outBaseDir, conferenceCode.toLowerCase()); // or keep exact
  const rawDir = path.join(outputDir, "raw");
  const idxDir = path.join(outputDir, "idx");
  const derivedDir = path.join(outputDir, "derived");

  await Promise.all([
    fs.mkdir(outputDir, { recursive: true }),
    fs.mkdir(rawDir, { recursive: true }),
    fs.mkdir(idxDir, { recursive: true }),
    fs.mkdir(derivedDir, { recursive: true }),
  ]);

  // 1) fetch everything in parallel
  const confPromise = getConference(db, conferenceCode);
  const fetchPromises = collections.map((c) =>
    fetchCollection(db, conferenceCode, c),
  );
  const [htConf, ...rawData] = await Promise.all([
    confPromise,
    ...fetchPromises,
  ]);

  // 2) build a name→data map
  const dataMap = Object.fromEntries(
    collections.map((name, i) => [name, rawData[i]]),
  );

  console.log(`Fetched for ${htConf.code} (${htConf.name}):`);
  for (const [name, items] of Object.entries(dataMap)) {
    console.log(` • ${items.length} ${name}`);
  }

  // 3) write raw JSON
  await Promise.all(
    Object.entries(dataMap).map(([name, data]) =>
      fs.writeFile(
        path.join(rawDir, `${name}.json`),
        // indent only in dev for readability
        JSON.stringify(data, null),
      ),
    ),
  );

  // save htConf as well
  await fs.writeFile(
    path.join(rawDir, "conference.json"),
    JSON.stringify(htConf, null, 0),
  );

  // ── post-processing ───────────────────────────────────────────────────────
  const scheduleData = processScheduleData(dataMap.events, dataMap.tagtypes);
  const groupedDates = createDateGroup(scheduleData, htConf.timezone);
  await fs.writeFile(
    path.join(derivedDir, "schedule.json"),
    JSON.stringify(Object.fromEntries(groupedDates), null, 0),
  );

  const peopleData = processSpeakers(dataMap.speakers, dataMap.events);
  await fs.writeFile(
    path.join(derivedDir, "people.json"),
    JSON.stringify(peopleData, null, 0),
  );

  const processedContent = processContentData(
    dataMap.content,
    dataMap.speakers,
    dataMap.tagtypes,
  );
  await fs.writeFile(
    path.join(derivedDir, "processedContent.json"),
    JSON.stringify(processedContent, null, 0),
  );

  const processedContentById = processContentDataById(
    dataMap.content,
    dataMap.speakers,
    dataMap.tagtypes,
    dataMap.locations,
  );
  await fs.writeFile(
    path.join(derivedDir, "processedContentById.json"),
    JSON.stringify(processedContentById, null, 0),
  );

  const processSearch = createSearchData(
    dataMap.speakers,
    dataMap.content,
    dataMap.organizations,
  );
  await fs.writeFile(
    path.join(idxDir, "search.json"),
    JSON.stringify(processSearch, null, 0),
  );

  const processTags = mapTagsToProcessedSchedule(
    dataMap.events,
    dataMap.tagtypes,
    htConf.timezone,
  );
  await fs.writeFile(
    path.join(derivedDir, "tags.json"),
    JSON.stringify(processTags, null, 0),
  );
}
