// Pipeline:
// 1) Fetch conference + raw collections
// 2) Optionally write raw snapshots
// 3) Build derived entities/indexes/views/manifest for fast lookups
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import { buildEntities } from "./build/entities.js";
import { buildIndexes } from "./build/indexes.js";
import { buildDerivedSiteMenu } from "./build/menus.js";
import { buildViews } from "./build/views.js";
import { buildManifest } from "./build/manifest.js";
import { ensureDir, writeJson, writeJsonSanitized } from "./io.js";
import { validateData } from "./validate.js";
import { verifyOutputs } from "./verify.js";

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

function sortCollection(items) {
  if (!items.length || items.some((item) => item?.id == null)) return items;
  return items
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
}

async function writeRawOutputs({ emitRaw, rawDir, dataMap, htConf }) {
  if (!emitRaw) return;
  await ensureDir(rawDir);
  await Promise.all(
    Object.entries(dataMap).map(([name, data]) =>
      writeJson(path.join(rawDir, `${name}.json`), data),
    ),
  );
  await writeJson(path.join(rawDir, "conference.json"), htConf);
}

export default async function conference(
  db,
  outBaseDir,
  conferenceCode,
  { emitRaw = false, strict = false, verify = false } = {},
) {
  const startedAt = Date.now();
  const outputDir = path.join(outBaseDir, conferenceCode.toLowerCase());
  const rawDir = path.join(outputDir, "raw");
  const entitiesDir = path.join(outputDir, "entities");
  const indexesDir = path.join(outputDir, "indexes");
  const viewsDir = path.join(outputDir, "views");
  const derivedDir = path.join(outputDir, "derived");

  // Writes entities, indexes, views, and manifest.json for fast lookups.
  await Promise.all([
    ensureDir(outputDir),
    ensureDir(entitiesDir),
    ensureDir(indexesDir),
    ensureDir(viewsDir),
    ensureDir(derivedDir),
  ]);

  console.log(`Starting export for ${conferenceCode} → ${outputDir}`);

  // 1) fetch everything in parallel
  const confPromise = getConference(db, conferenceCode);
  const fetchPromises = collections.map((c) =>
    fetchCollection(db, conferenceCode, c),
  );
  const [htConf, ...rawData] = await Promise.all([
    confPromise,
    ...fetchPromises,
  ]);

  if (!htConf?.timezone) {
    throw new Error("Missing htConf.timezone");
  }

  // 2) build a name→data map
  const dataMap = Object.fromEntries(
    collections.map((name, i) => [name, sortCollection(rawData[i])]),
  );

  console.log(`Fetched for ${htConf.code} (${htConf.name}):`);
  for (const [name, items] of Object.entries(dataMap)) {
    console.log(` • ${items.length} ${name}`);
  }

  const { warnings, summary } = validateData({
    dataMap,
    timeZone: htConf.timezone,
  });
  const warningEntries = [
    summary.invalidTimezone ? `invalid timezone` : null,
    summary.missingEventLocations
      ? `events missing locations=${summary.missingEventLocations}`
      : null,
    summary.missingEventPeople
      ? `events missing people=${summary.missingEventPeople}`
      : null,
    summary.missingEventTags
      ? `events missing tags=${summary.missingEventTags}`
      : null,
    summary.missingEventContent
      ? `events missing content=${summary.missingEventContent}`
      : null,
    summary.missingEventBegin
      ? `events missing/invalid begin=${summary.missingEventBegin}`
      : null,
    summary.missingEventEnd
      ? `events missing/invalid end=${summary.missingEventEnd}`
      : null,
    summary.invalidEventRanges
      ? `events begin>=end=${summary.invalidEventRanges}`
      : null,
    summary.missingContentTags
      ? `content missing tags=${summary.missingContentTags}`
      : null,
    summary.missingContentPeople
      ? `content missing people=${summary.missingContentPeople}`
      : null,
  ].filter(Boolean);
  if (warningEntries.length) {
    console.warn(`⚠️  Warnings: ${warningEntries.join("; ")}`);
  } else if (warnings.length) {
    console.warn("⚠️  Warnings: unknown validation issues");
  } else {
    console.log("Warnings: none");
  }
  if (strict && (warnings.length || warningEntries.length)) {
    throw new Error("Validation failed under --strict");
  }

  // 3) optionally write raw JSON
  await writeRawOutputs({ emitRaw, rawDir, dataMap, htConf });

  // - derived entities/indexes/views/manifest ───────────────────────────────
  const derivedMenu = buildDerivedSiteMenu(dataMap);
  console.log(
    `Derived: siteMenu primary=${derivedMenu.primary.length} sections=${derivedMenu.sections?.length ?? 0}`,
  );
  const entities = buildEntities(dataMap);
  const { indexes } = buildIndexes({
    entities,
    timeZone: htConf.timezone,
  });
  const views = buildViews({ entities });
  const manifest = buildManifest({ htConf });

  const entityCounts = Object.entries(entities)
    .map(([name, store]) => `${name}=${store.allIds.length}`)
    .join(", ");
  const indexCounts = Object.entries(indexes)
    .map(([name, index]) => `${name}=${Object.keys(index).length}`)
    .join(", ");
  const organizationsCardsUniqueCount = (() => {
    const seen = new Set();
    for (const list of Object.values(views.organizationsCards || {})) {
      if (!Array.isArray(list)) continue;
      for (const card of list) {
        if (card?.id == null) continue;
        seen.add(String(card.id));
      }
    }
    return seen.size;
  })();
  const viewCounts = [
    `eventCardsById=${Object.keys(views.eventCardsById || {}).length}`,
    `organizationsCards=${organizationsCardsUniqueCount}`,
    `peopleCards=${views.peopleCards?.length ?? 0}`,
    `tagTypesBrowse=${views.tagTypesBrowse?.length ?? 0}`,
    `documentsList=${views.documentsList?.length ?? 0}`,
    `contentCards=${views.contentCards?.length ?? 0}`,
  ].join(", ");
  console.log(`Entities: ${entityCounts}`);
  console.log(`Indexes: ${indexCounts}`);
  console.log(`Views: ${viewCounts}`);

  if (verify) {
    const { errors } = verifyOutputs({ entities, indexes, views });
    if (errors.length) {
      const preview = errors.slice(0, 5).join("; ");
      throw new Error(
        `Verify failed (${errors.length} issues). ${preview}${errors.length > 5 ? "…" : ""}`,
      );
    }
    console.log("Verify: ok");
  }

  // Client stores entities/*, indexes/*, and views/eventCardsById in IndexedDB for fast lookups and join-free schedule rendering.
  await Promise.all(
    Object.entries(entities)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, payload]) =>
        writeJsonSanitized(path.join(entitiesDir, `${name}.json`), payload),
      ),
  );

  await Promise.all(
    Object.entries(indexes)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, payload]) =>
        writeJsonSanitized(path.join(indexesDir, `${name}.json`), payload),
      ),
  );

  await Promise.all(
    Object.entries(views)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, payload]) =>
        writeJsonSanitized(path.join(viewsDir, `${name}.json`), payload),
      ),
  );

  await writeJsonSanitized(
    path.join(derivedDir, "siteMenu.json"),
    derivedMenu,
  );
  await writeJsonSanitized(path.join(outputDir, "manifest.json"), manifest);

  console.log(`Output root: ${outputDir}`);
  console.log(`Raw outputs emitted: ${emitRaw}`);
  if (emitRaw) console.log(`Raw output: ${rawDir}`);
  console.log(`Finished in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
}
