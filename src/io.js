import fs from "fs/promises";
import path from "path";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return value.constructor === Object;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (!isPlainObject(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
}

function sanitizeString(value) {
  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\t/g, " ");
  const lines = normalized.split("\n").map((line) => {
    const collapsed = line.replace(/ {3,}/g, " ");
    return collapsed.replace(/ +$/g, "");
  });
  return lines.join("\n");
}

export function sanitizeStringsDeep(value) {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStringsDeep(item));
  }
  if (!isPlainObject(value)) return value;

  return Object.keys(value).reduce((acc, key) => {
    acc[key] = sanitizeStringsDeep(value[key]);
    return acc;
  }, {});
}

export function stableStringify(value, indent = 0) {
  return JSON.stringify(sortKeysDeep(value), null, indent);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, data, indent = 0) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, stableStringify(data, indent));
}

export async function writeJsonSanitized(filePath, data, indent = 0) {
  await ensureDir(path.dirname(filePath));
  const sanitized = sanitizeStringsDeep(data);
  await fs.writeFile(filePath, stableStringify(sanitized, indent));
}
