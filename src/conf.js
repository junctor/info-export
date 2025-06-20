// src/conference.js
import fs from "fs/promises";
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import {
  createDateGroup,
  processContentData,
  processScheduleData,
  processSpeakers,
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

export default async function conference(db, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  // 1) fetch everything in parallel
  const confPromise = getConference(db);
  const fetchPromises = collections.map((c) => fetchCollection(db, c));
  const [htConf, ...rawData] = await Promise.all([
    confPromise,
    ...fetchPromises,
  ]);

  // 2) build a name→data map
  const dataMap = Object.fromEntries(
    collections.map((name, i) => [name, rawData[i]])
  );

  console.log(`Fetched for ${htConf.code} (${htConf.name}):`);
  for (const [name, items] of Object.entries(dataMap)) {
    console.log(` • ${items.length} ${name}`);
  }

  // 3) write raw JSON
  await Promise.all(
    Object.entries(dataMap).map(([name, data]) =>
      fs.writeFile(
        path.join(outputDir, `${name}.json`),
        // indent only in dev for readability
        JSON.stringify(data, null)
      )
    )
  );

  // ── post-processing ───────────────────────────────────────────────────────
  const scheduleData = processScheduleData(dataMap.events, dataMap.tagtypes);
  const groupedDates = createDateGroup(scheduleData);
  await fs.writeFile(
    path.join(outputDir, "schedule.json"),
    JSON.stringify(Object.fromEntries(groupedDates), null, 2)
  );

  const peopleData = processSpeakers(dataMap.speakers, dataMap.events);
  await fs.writeFile(
    path.join(outputDir, "people.json"),
    JSON.stringify(peopleData, null, 2)
  );

  const processedContent = processContentData(
    dataMap.content,
    dataMap.speakers
  );
  await fs.writeFile(
    path.join(outputDir, "processedContent.json"),
    JSON.stringify(processedContent, null, 2)
  );
}
