// Pipeline:
// 1) Fetch conference + raw collections
// 2) Optionally write raw snapshots
// 3) Build derived entities/indexes/views/manifest for fast lookups
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import { buildEntities } from "./build/entities.js";
import { buildIndexes } from "./build/indexes.js";
import { buildTagIdsByLabel } from "./build/tags.js";
import { buildViews } from "./build/views.js";
import { buildManifest } from "./build/manifest.js";
import { ensureDir, removeDir, stableStringify, writeJson, writeJsonSanitized } from "./io.js";

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

const outputEntityNames = [
  "articles",
  "content",
  "documents",
  "events",
  "locations",
  "organizations",
  "people",
  "tags",
];

const outputIndexNames = ["eventsByDay", "eventsByTag"];

const outputViewNames = [
  "contentCards",
  "documentsList",
  "organizationsCards",
  "peopleCards",
  "searchData",
  "tagTypesBrowse",
];

function buildJsonWrites({ source, names, dir }) {
  return names.map((name) => {
    if (!Object.prototype.hasOwnProperty.call(source, name)) {
      throw new Error(`Missing generated artifact: ${name}`);
    }
    return writeJsonSanitized(path.join(dir, `${name}.json`), source[name]);
  });
}

function sortCollection(items) {
  if (!items.length) return items;
  const withKeys = items.map((item) => {
    const idKey = item?.id == null ? null : String(item.id);
    return {
      item,
      idKey,
      fallbackKey: idKey == null ? stableStringify(item) : null,
    };
  });
  return withKeys
    .sort((a, b) => {
      if (a.idKey != null && b.idKey != null) {
        return a.idKey.localeCompare(b.idKey, "en");
      }
      if (a.idKey != null) return -1;
      if (b.idKey != null) return 1;
      const fallbackCompare = String(a.fallbackKey).localeCompare(String(b.fallbackKey), "en");
      if (fallbackCompare !== 0) return fallbackCompare;
      return 0;
    })
    .map(({ item }) => item);
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

export default async function conference(db, outBaseDir, conferenceCode, { emitRaw = false } = {}) {
  const schemaVersion = Number(process.env.SCHEMA_VERSION ?? 2);
  if (schemaVersion !== 2) {
    throw new Error(`Unsupported SCHEMA_VERSION=${process.env.SCHEMA_VERSION ?? ""}; expected 2`);
  }
  const startedAt = Date.now();
  const outputDir = path.join(outBaseDir, conferenceCode.toLowerCase());
  const rawDir = path.join(outputDir, "raw");
  const entitiesDir = path.join(outputDir, "entities");
  const indexesDir = path.join(outputDir, "indexes");
  const viewsDir = path.join(outputDir, "views");
  const derivedDir = path.join(outputDir, "derived");

  // Recreate artifact directories so removed runtime files do not linger.
  await ensureDir(outputDir);
  await Promise.all([
    removeDir(entitiesDir),
    removeDir(indexesDir),
    removeDir(viewsDir),
    removeDir(derivedDir),
    removeDir(rawDir),
  ]);
  await Promise.all([
    ensureDir(entitiesDir),
    ensureDir(indexesDir),
    ensureDir(viewsDir),
    ensureDir(derivedDir),
  ]);

  console.log(`Starting export for ${conferenceCode} → ${outputDir}`);

  // 1) fetch everything in parallel
  const confPromise = getConference(db, conferenceCode);
  const fetchPromises = collections.map((c) => fetchCollection(db, conferenceCode, c));
  const [htConf, ...rawData] = await Promise.all([confPromise, ...fetchPromises]);

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

  // Build client artifacts.
  const entities = buildEntities(dataMap, htConf.timezone);
  const { indexes } = buildIndexes({
    entities,
    timeZone: htConf.timezone,
  });
  const views = buildViews({ entities });
  const manifest = buildManifest({ htConf, schemaVersion });
  const tagIdsByLabel = buildTagIdsByLabel(dataMap);

  const entityCounts = outputEntityNames
    .map((name) => [name, entities[name]])
    .map(([name, store]) => `${name}=${store.allIds.length}`)
    .join(", ");
  const indexCounts = outputIndexNames
    .map((name) => [name, indexes[name]])
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
    `organizationsCards=${organizationsCardsUniqueCount}`,
    `peopleCards=${views.peopleCards?.length ?? 0}`,
    `tagTypesBrowse=${views.tagTypesBrowse?.length ?? 0}`,
    `documentsList=${views.documentsList?.length ?? 0}`,
    `contentCards=${views.contentCards?.length ?? 0}`,
  ].join(", ");
  console.log(`Entities: ${entityCounts}`);
  console.log(`Indexes: ${indexCounts}`);
  console.log(`Views: ${viewCounts}`);
  console.log(
    `Derived: tagIdsByLabel keys=${Object.keys(tagIdsByLabel.byLabel).length} collisions=${Object.keys(tagIdsByLabel.collisions ?? {}).length}`,
  );

  // Client stores the explicit runtime artifact set in IndexedDB.
  const entityWrites = buildJsonWrites({
    source: entities,
    names: outputEntityNames,
    dir: entitiesDir,
  });
  const indexWrites = buildJsonWrites({
    source: indexes,
    names: outputIndexNames,
    dir: indexesDir,
  });
  const viewWrites = buildJsonWrites({
    source: views,
    names: outputViewNames,
    dir: viewsDir,
  });

  await Promise.all([
    writeRawOutputs({ emitRaw, rawDir, dataMap, htConf }),
    writeJsonSanitized(path.join(outputDir, "manifest.json"), manifest),
    writeJsonSanitized(path.join(derivedDir, "tagIdsByLabel.json"), tagIdsByLabel),
    ...entityWrites,
    ...indexWrites,
    ...viewWrites,
  ]);

  console.log(`Output root: ${outputDir}`);
  console.log(`Raw outputs emitted: ${emitRaw}`);
  if (emitRaw) console.log(`Raw output: ${rawDir}`);
  console.log(`Finished in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
}
