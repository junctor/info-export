// Pipeline:
// 1) Fetch conference + raw collections
// 2) Optionally write raw snapshots
// 3) Build derived entities/indexes/views/manifest for fast lookups
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import { buildEntities } from "./build/entities.js";
import { buildIndexes } from "./build/indexes.js";
import { buildTagIdsByLabel } from "./build/tags.js";
import { buildPageReadyArtifacts, buildViews } from "./build/views.js";
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
  "announcementsList",
  "bookmarkEventsById",
  "contentCards",
  "documentsList",
  "locationCards",
  "organizationsCards",
  "peopleCards",
  "searchData",
  "scheduleDays",
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

function buildDetailWrites({ details, dir }) {
  const writes = [];
  for (const groupName of Object.keys(details).sort()) {
    const byId = details[groupName] ?? {};
    for (const id of Object.keys(byId).sort((a, b) => Number(a) - Number(b))) {
      writes.push(writeJsonSanitized(path.join(dir, groupName, `${id}.json`), byId[id]));
    }
  }
  return writes;
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

export default async function conference(
  db,
  outBaseDir,
  conferenceCode,
  { emitRaw = false, verbose = false } = {},
) {
  const schemaVersion = Number(process.env.SCHEMA_VERSION ?? 2);
  if (schemaVersion !== 2) {
    throw new Error(`Unsupported SCHEMA_VERSION=${process.env.SCHEMA_VERSION ?? ""}; expected 2`);
  }
  const log = (...args) => {
    if (verbose) console.log(...args);
  };
  const startedAt = Date.now();
  const outputDir = path.join(outBaseDir, conferenceCode.toLowerCase());
  const rawDir = path.join(outputDir, "raw");
  const entitiesDir = path.join(outputDir, "entities");
  const indexesDir = path.join(outputDir, "indexes");
  const viewsDir = path.join(outputDir, "views");
  const detailsDir = path.join(outputDir, "details");
  const derivedDir = path.join(outputDir, "derived");

  // Recreate artifact directories so removed runtime files do not linger.
  await ensureDir(outputDir);
  await Promise.all([
    removeDir(entitiesDir),
    removeDir(indexesDir),
    removeDir(viewsDir),
    removeDir(detailsDir),
    removeDir(derivedDir),
    removeDir(rawDir),
  ]);
  await Promise.all([
    ensureDir(entitiesDir),
    ensureDir(indexesDir),
    ensureDir(viewsDir),
    ensureDir(detailsDir),
    ensureDir(derivedDir),
  ]);

  log(`Starting export for ${conferenceCode} -> ${outputDir}`);

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

  log(`Fetched for ${htConf.code} (${htConf.name}):`);
  for (const [name, items] of Object.entries(dataMap)) {
    log(` - ${items.length} ${name}`);
  }

  // Build client artifacts.
  const entities = buildEntities(dataMap, htConf.timezone);
  const { indexes } = buildIndexes({
    entities,
    timeZone: htConf.timezone,
  });
  const pageReadyArtifacts = buildPageReadyArtifacts({
    entities,
    indexes,
    timeZone: htConf.timezone,
  });
  const views = {
    ...buildViews({ entities }),
    ...pageReadyArtifacts.views,
  };
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
    `scheduleDays=${views.scheduleDays?.length ?? 0}`,
    `locationCards=${views.locationCards?.length ?? 0}`,
  ].join(", ");
  log(`Entities: ${entityCounts}`);
  log(`Indexes: ${indexCounts}`);
  log(`Views: ${viewCounts}`);
  log(
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
  const detailWrites = buildDetailWrites({
    details: pageReadyArtifacts.details,
    dir: detailsDir,
  });

  await Promise.all([
    writeRawOutputs({ emitRaw, rawDir, dataMap, htConf }),
    writeJsonSanitized(path.join(outputDir, "manifest.json"), manifest),
    writeJsonSanitized(path.join(derivedDir, "tagIdsByLabel.json"), tagIdsByLabel),
    ...entityWrites,
    ...indexWrites,
    ...viewWrites,
    ...detailWrites,
  ]);

  const durationMs = Date.now() - startedAt;
  log(`Output root: ${outputDir}`);
  log(`Raw outputs emitted: ${emitRaw}`);
  if (emitRaw) log(`Raw output: ${rawDir}`);
  log(`Finished in ${(durationMs / 1000).toFixed(2)}s`);

  return {
    code: htConf.code ?? conferenceCode,
    name: htConf.name ?? conferenceCode,
    outputDir,
    rawDir: emitRaw ? rawDir : null,
    durationMs,
  };
}
