import fs from "fs";
import { getEvents, getSpeakers, getTags } from "./fb.js";
import { processScheduleData } from "./utils.js";

export default async function conference(fbDb, htConf, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const [htEvents, htSpeakers, htTags] = await Promise.all([
    getEvents(fbDb, htConf),
    getSpeakers(fbDb, htConf),
    getTags(fbDb, htConf),
  ]);

  await Promise.all([
    fs.promises.writeFile(`${outputDir}/events.json`, JSON.stringify(htEvents)),
    fs.promises.writeFile(
      `${outputDir}/speakers.json`,
      JSON.stringify(htSpeakers)
    ),
    fs.promises.writeFile(`${outputDir}/tags.json`, JSON.stringify(htTags)),
  ]);

  const eventColors = htEvents.map((e) => e.type.color);
  const tagColors = htTags.flatMap((t) =>
    t.tags.map((e) => e.color_background)
  );

  const confColors = new Set(
    [...eventColors, ...tagColors].filter((t) => t !== null)
  );

  const colorOutput = {
    colors: Array.from(confColors).sort(),
  };

  await fs.promises.writeFile(
    `${outputDir}/colors.json`,
    JSON.stringify(colorOutput)
  );

  const scheduleData = processScheduleData(htEvents, htTags);

  await fs.promises.writeFile(
    `${outputDir}/schedule.json`,
    JSON.stringify(scheduleData)
  );
}
