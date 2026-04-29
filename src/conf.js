// Pipeline:
// 1) Fetch conference + raw collections
// 2) Optionally write raw snapshots
// 3) Build derived entities/indexes/views/manifest for fast lookups
import path from "path";
import { fetchCollection, getConference } from "./fb.js";
import { buildEntities } from "./build/entities.js";
import { buildIndexes } from "./build/indexes.js";
import { buildViews } from "./build/views.js";
import { buildManifest } from "./build/manifest.js";
import {
  ensureDir,
  removeDir,
  stableStringify,
  writeJson,
  writeJsonSanitized,
} from "./io.js";

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
      const fallbackCompare = String(a.fallbackKey).localeCompare(
        String(b.fallbackKey),
        "en",
      );
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
  { emitRaw = false } = {},
) {
  const schemaVersion = Number(process.env.SCHEMA_VERSION ?? 2);
  if (schemaVersion !== 2) {
    throw new Error(
      `Unsupported SCHEMA_VERSION=${process.env.SCHEMA_VERSION ?? ""}; expected 2`,
    );
  }
  const startedAt = Date.now();
  const outputDir = path.join(outBaseDir, conferenceCode.toLowerCase());
  const rawDir = path.join(outputDir, "raw");
  const entitiesDir = path.join(outputDir, "entities");
  const indexesDir = path.join(outputDir, "indexes");
  const viewsDir = path.join(outputDir, "views");
  const legacyDerivedDir = path.join(outputDir, "derived");

  // Writes entities, indexes, views, and manifest.json for fast lookups.
  await Promise.all([
    ensureDir(outputDir),
    ensureDir(entitiesDir),
    ensureDir(indexesDir),
    ensureDir(viewsDir),
    removeDir(legacyDerivedDir),
    emitRaw ? Promise.resolve() : removeDir(rawDir),
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

  // Build client artifacts.
  const entities = buildEntities(dataMap, htConf.timezone);
  const { indexes } = buildIndexes({
    entities,
    timeZone: htConf.timezone,
  });
  const views = buildViews({ entities });
  const manifest = buildManifest({ htConf, schemaVersion });

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

  // Client stores entities/*, indexes/*, and views/* in IndexedDB for fast lookups.
  const entityWrites = Object.entries(entities)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([name, payload]) =>
      writeJsonSanitized(path.join(entitiesDir, `${name}.json`), payload),
    );
  const indexWrites = Object.entries(indexes)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([name, payload]) =>
      writeJsonSanitized(path.join(indexesDir, `${name}.json`), payload),
    );
  const viewWrites = Object.entries(views)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([name, payload]) =>
      writeJsonSanitized(path.join(viewsDir, `${name}.json`), payload),
    );

  await Promise.all([
    writeRawOutputs({ emitRaw, rawDir, dataMap, htConf }),
    writeJsonSanitized(path.join(outputDir, "manifest.json"), manifest),
    ...entityWrites,
    ...indexWrites,
    ...viewWrites,
  ]);

  console.log(`Output root: ${outputDir}`);
  console.log(`Raw outputs emitted: ${emitRaw}`);
  if (emitRaw) console.log(`Raw output: ${rawDir}`);
  console.log(`Finished in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
}
