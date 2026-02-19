import { normalizeId } from "./schema.js";

const COMBINING_MARKS_REGEX = /\p{M}/gu;
const LETTER_OR_NUMBER_REGEX = /[\p{L}\p{N}]/u;

function alphaSort(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "en", {
    sensitivity: "base",
  });
}

export function normalizeForSearch(text) {
  if (text == null) return "";
  const normalized = String(text)
    .normalize("NFKD")
    .toLowerCase()
    .replace(COMBINING_MARKS_REGEX, "");
  let next = "";
  let hadSpace = false;
  for (const ch of normalized) {
    if (LETTER_OR_NUMBER_REGEX.test(ch)) {
      if (hadSpace && next) next += " ";
      next += ch;
      hadSpace = false;
    } else {
      hadSpace = true;
    }
  }
  return next.trim();
}

export function searchIndex(indexArray, query) {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return [];
  return (indexArray || []).filter((item) =>
    String(item?.norm ?? "").includes(normalizedQuery),
  );
}

export function createSearchData(speakers, content, organizations) {
  const items = [];

  for (const speaker of speakers || []) {
    const text = speaker?.name;
    const id = normalizeId(speaker?.id);
    if (id == null) continue;
    items.push({
      id,
      text,
      type: "person",
      norm: normalizeForSearch(text),
    });
  }

  for (const item of content || []) {
    const text = item?.title;
    const id = normalizeId(item?.id);
    if (id == null) continue;
    items.push({
      id,
      text,
      type: "content",
      norm: normalizeForSearch(text),
    });
  }

  for (const org of organizations || []) {
    const text = org?.name;
    const id = normalizeId(org?.id);
    if (id == null) continue;
    items.push({
      id,
      text,
      type: "organization",
      norm: normalizeForSearch(text),
    });
  }

  return items.sort((a, b) => alphaSort(a.text, b.text));
}
