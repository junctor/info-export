import fs from "fs";
import path from "path";
import { getEvents, getSpeakers, getTags } from "./fb.js";
import {
  createDateGroup,
  processScheduleData,
  processSpeakers,
} from "./utils.js";

export default async function conference(fbDb, htConf, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const [htEvents, htSpeakers, htTags] = await Promise.all([
    getEvents(fbDb, htConf),
    getSpeakers(fbDb, htConf),
    getTags(fbDb, htConf),
  ]);

  console.log(
    `Fetched: ${htEvents.length} events, ${htSpeakers.length} speakers, ${htTags.length} tag groups for ${htConf}`
  );

  // Write raw data
  await Promise.all([
    fs.promises.writeFile(
      path.join(outputDir, "events.json"),
      JSON.stringify(htEvents)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "speakers.json"),
      JSON.stringify(htSpeakers)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "tags.json"),
      JSON.stringify(htTags)
    ),
  ]);

  // Schedule processing
  const scheduleData = processScheduleData(htEvents, htTags);
  const groupedDates = createDateGroup(scheduleData);

  await fs.promises.writeFile(
    path.join(outputDir, "schedule.json"),
    JSON.stringify(Object.fromEntries(groupedDates))
  );

  // People processing
  const peopleData = processSpeakers(htSpeakers, htEvents);
  await fs.promises.writeFile(
    path.join(outputDir, "people.json"),
    JSON.stringify(peopleData)
  );
}
