import { normalizeId, uniqAndFilterIds } from "./schema.js";

function cleanString(value) {
  if (value == null) return "";
  const cleaned = String(value).trim();
  return cleaned;
}

function normalizeNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sortItems(items) {
  return items.slice().sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    const titleCompare = String(a.title).localeCompare(String(b.title), "en");
    if (titleCompare !== 0) return titleCompare;
    return a.id - b.id;
  });
}

function resolveFirstItemSort(menu) {
  if (!Array.isArray(menu?.items) || !menu.items.length) return Infinity;
  let min = Infinity;
  for (const item of menu.items) {
    const sortValue = Number(item?.sort_order);
    if (!Number.isFinite(sortValue)) continue;
    if (sortValue < min) min = sortValue;
  }
  return min;
}

function pickPrimaryMenu(menus) {
  if (!Array.isArray(menus) || !menus.length) return null;
  const home = menus.find(
    (menu) => cleanString(menu?.title_text).toLowerCase() === "home",
  );
  if (home) return home;

  const sorted = menus
    .map((menu) => ({
      menu,
      firstSort: resolveFirstItemSort(menu),
      menuId: normalizeNumber(menu?.id) ?? Infinity,
    }))
    .sort((a, b) => {
      if (a.firstSort !== b.firstSort) return a.firstSort - b.firstSort;
      return a.menuId - b.menuId;
    });

  return sorted[0]?.menu ?? null;
}

function buildMenuItems(menu) {
  if (!Array.isArray(menu?.items)) return [];
  const items = [];
  for (const item of menu.items) {
    const title = cleanString(item?.title_text);
    const fn = cleanString(item?.function);
    const sortValue = Number(item?.sort_order);
    const itemId = normalizeId(item?.id);
    if (!title || !fn || !Number.isFinite(sortValue) || itemId == null) {
      continue;
    }

    const derived = {
      id: itemId,
      title,
      sort: sortValue,
      fn,
    };

    const documentId = normalizeId(item?.document_id);
    if (documentId != null) derived.documentId = documentId;

    const menuId = normalizeId(item?.menu_id);
    if (menuId != null) derived.menuId = menuId;

    const tagIds = uniqAndFilterIds(item?.applied_tag_ids || []).sort(
      (a, b) => a - b,
    );
    if (tagIds.length) derived.tagIds = tagIds;

    const icon =
      cleanString(item?.google_materialsymbol) ||
      cleanString(item?.apple_sfsymbol);
    if (icon) derived.icon = icon;

    if (item?.prohibit_tag_filter === "Y") {
      derived.prohibitTagFilter = true;
    }

    items.push(derived);
  }
  return items;
}

export function buildDerivedSiteMenu(dataMap) {
  const menus = Array.isArray(dataMap?.menus)
    ? dataMap.menus
    : Array.isArray(dataMap)
      ? dataMap
      : [];

  if (!menus.length) {
    console.warn("⚠️ menus missing/empty; derived/siteMenu.json will be empty");
    return { version: 1, primary: [] };
  }

  const primaryMenu = pickPrimaryMenu(menus);
  const primary = primaryMenu ? sortItems(buildMenuItems(primaryMenu)) : [];

  const sections = menus
    .filter((menu) => menu && menu !== primaryMenu)
    .map((menu) => {
      const menuId = normalizeId(menu?.id);
      if (menuId == null) return null;
      const items = sortItems(buildMenuItems(menu));
      if (!items.length) return null;
      return {
        id: menuId,
        title: cleanString(menu?.title_text),
        items,
      };
    })
    .filter(Boolean);

  const derived = { version: 1, primary };
  if (sections.length) derived.sections = sections;
  return derived;
}
