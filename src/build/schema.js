export function normalizeId(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function sortById(a, b) {
  return a.id - b.id;
}

export function buildEntityMap(items) {
  const sorted = items.slice().sort(sortById);
  const byId = {};
  const allIds = [];
  for (const item of sorted) {
    if (!item || item.id == null) {
      throw new Error("buildEntityMap requires items with id");
    }
    if (!Number.isFinite(item.id)) {
      throw new Error("buildEntityMap requires numeric ids");
    }
    const id = item.id;
    if (Object.prototype.hasOwnProperty.call(byId, id)) continue;
    byId[id] = item;
    allIds.push(id);
  }
  return { allIds, byId };
}

export function uniqAndFilterIds(ids, validSet) {
  const seen = new Set();
  const next = [];
  for (const id of ids || []) {
    const key = normalizeId(id);
    if (key == null) continue;
    if (validSet && !validSet.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  return next;
}

export function resolveUpdatedAtMs(item) {
  if (item?.updated_at?.seconds != null) {
    return item.updated_at.seconds * 1000;
  }
  if (typeof item?.updated_at === "string") {
    const ms = Date.parse(item.updated_at);
    return Number.isFinite(ms) ? ms : null;
  }
  if (item?.updated_at?.toDate) {
    return item.updated_at.toDate().getTime();
  }
  if (typeof item?.updated_tsz === "string") {
    const ms = Date.parse(item.updated_tsz);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof item?.updated_at_str === "string") {
    const ms = Date.parse(item.updated_at_str);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}
