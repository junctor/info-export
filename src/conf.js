import fs from "fs";
import path from "path";
import { getEvents, getSpeakers, getTags } from "./fb.js";
import { createDateGroup, processScheduleData } from "./utils.js";

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

  // Color extraction
  const eventColors = htEvents.map((e) => e.type?.color).filter(Boolean);
  const tagColors = htTags
    .flatMap((t) => t.tags.map((e) => e.color_background))
    .filter(Boolean);
  const confColors = new Set([...eventColors, ...tagColors]);

  await fs.promises.writeFile(
    path.join(outputDir, "colors.json"),
    JSON.stringify({ colors: Array.from(confColors).sort() })
  );

  // Schedule processing
  const scheduleData = processScheduleData(htEvents, htTags);
  const groupedDates = createDateGroup(scheduleData);

  await fs.promises.writeFile(
    path.join(outputDir, "schedule.json"),
    JSON.stringify(Object.fromEntries(groupedDates))
  );
}
