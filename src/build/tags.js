import { normalizeId } from "./schema.js";

function cleanString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeLabel(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return "";
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compareIdStrings(a, b) {
  return String(a).localeCompare(String(b), "en");
}

export function buildTagIdsByLabel(dataMap) {
  const tagtypes = Array.isArray(dataMap?.tagtypes) ? dataMap.tagtypes : [];
  if (!tagtypes.length) {
    console.warn(
      "⚠️ tagtypes missing/empty; derived/tagIdsByLabel.json will be empty",
    );
    return { version: 1, byLabel: {} };
  }

  const byLabel = {};
  const collisions = new Map();

  for (const tagtype of tagtypes) {
    const tags = Array.isArray(tagtype?.tags) ? tagtype.tags : [];
    for (const tag of tags) {
      const id = normalizeId(tag?.id);
      if (id == null) continue;
      const key = normalizeLabel(tag?.label);
      if (!key) continue;

      const existing = byLabel[key];
      if (existing == null) {
        byLabel[key] = id;
        continue;
      }

      if (existing !== id) {
        const minId = compareIdStrings(existing, id) <= 0 ? existing : id;
        byLabel[key] = minId;
        const set = collisions.get(key) ?? new Set();
        set.add(existing);
        set.add(id);
        collisions.set(key, set);
      }
    }
  }

  const result = { version: 1, byLabel };
  if (collisions.size) {
    const collisionObj = {};
    for (const [key, set] of collisions.entries()) {
      collisionObj[key] = Array.from(set).sort(compareIdStrings);
    }
    result.collisions = collisionObj;
  }
  return result;
}
