import fs from "fs";
import path from "path";
import {
  getConference,
  getContent,
  getDocuments,
  getEvents,
  getLocations,
  getMenus,
  getNews,
  getOrganizations,
  getSpeakers,
  getTags,
} from "./fb.js";
import {
  createDateGroup,
  processScheduleData,
  processSpeakers,
} from "./utils.js";

export default async function conference(fbDb, outputDir) {
  await fs.promises.mkdir(outputDir, { recursive: true });

  const [
    htEvents,
    htSpeakers,
    htTags,
    htConf,
    htOrgs,
    htLocs,
    htNews,
    htDocs,
    htMenus,
    htContent,
  ] = await Promise.all([
    getEvents(fbDb),
    getSpeakers(fbDb),
    getTags(fbDb),
    getConference(fbDb),
    getOrganizations(fbDb),
    getLocations(fbDb),
    getNews(fbDb),
    getDocuments(fbDb),
    getMenus(fbDb),
    getContent(fbDb),
  ]);

  console.log(
    `Fetched: ${htEvents.length} events, ${htSpeakers.length} speakers, ${htTags.length} tag groups for ${htConf.code}`
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
    fs.promises.writeFile(
      path.join(outputDir, "conf.json"),
      JSON.stringify(htTags)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "organizations.json"),
      JSON.stringify(htOrgs)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "locations.json"),
      JSON.stringify(htLocs)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "news.json"),
      JSON.stringify(htNews)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "documents.json"),
      JSON.stringify(htDocs)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "menus.json"),
      JSON.stringify(htMenus)
    ),
    fs.promises.writeFile(
      path.join(outputDir, "content.json"),
      JSON.stringify(htContent)
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
