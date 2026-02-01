import fs from "fs/promises";
import path from "path";
import { verifyOutputs } from "../src/verify.js";

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function loadSection(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const section = {};
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const name = entry.name.replace(/\.json$/, "");
    section[name] = await readJson(path.join(dirPath, entry.name));
  }
  return section;
}

function assertString(value, label, errors) {
  if (typeof value !== "string") {
    errors.push(`${label} expected string`);
  }
}

function assertStringArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} expected array`);
    return;
  }
  for (const item of value) {
    if (typeof item !== "string") {
      errors.push(`${label} expected string entries`);
      return;
    }
  }
}

function checkForeignKeys(entities, errors) {
  for (const event of Object.values(entities.events.byId || {})) {
    assertString(event.id, "event.id", errors);
    if (event.contentId != null) assertString(event.contentId, "event.contentId", errors);
    if (event.locationId != null) assertString(event.locationId, "event.locationId", errors);
    if (event.tagIds) assertStringArray(event.tagIds, "event.tagIds", errors);
    if (event.speakerIds) assertStringArray(event.speakerIds, "event.speakerIds", errors);
    if (event.personIds) assertStringArray(event.personIds, "event.personIds", errors);
  }

  for (const item of Object.values(entities.content.byId || {})) {
    assertString(item.id, "content.id", errors);
    if (item.tagIds) assertStringArray(item.tagIds, "content.tagIds", errors);
    if (item.sessions) assertStringArray(item.sessions, "content.sessions", errors);
    if (Array.isArray(item.people)) {
      for (const person of item.people) {
        if (person?.personId != null) {
          assertString(person.personId, "content.people.personId", errors);
        }
      }
    }
  }

  for (const person of Object.values(entities.people.byId || {})) {
    assertString(person.id, "people.id", errors);
    if (person.contentIds) assertStringArray(person.contentIds, "people.contentIds", errors);
  }

  for (const location of Object.values(entities.locations.byId || {})) {
    assertString(location.id, "locations.id", errors);
    if (location.parentId != null) {
      assertString(location.parentId, "locations.parentId", errors);
    }
  }

  for (const org of Object.values(entities.organizations.byId || {})) {
    assertString(org.id, "organizations.id", errors);
    if (org.tagIdAsOrganizer != null) {
      assertString(org.tagIdAsOrganizer, "organizations.tagIdAsOrganizer", errors);
    }
    if (org.tagIds) assertStringArray(org.tagIds, "organizations.tagIds", errors);
  }

  for (const tag of Object.values(entities.tags.byId || {})) {
    assertString(tag.id, "tags.id", errors);
    if (tag.tagTypeId != null) assertString(tag.tagTypeId, "tags.tagTypeId", errors);
  }

  for (const tagType of Object.values(entities.tagTypes.byId || {})) {
    assertString(tagType.id, "tagTypes.id", errors);
  }

  for (const article of Object.values(entities.articles.byId || {})) {
    assertString(article.id, "articles.id", errors);
  }

  for (const doc of Object.values(entities.documents.byId || {})) {
    assertString(doc.id, "documents.id", errors);
  }

  for (const menu of Object.values(entities.menus.byId || {})) {
    assertString(menu.id, "menus.id", errors);
    if (Array.isArray(menu.items)) {
      for (const item of menu.items) {
        assertString(item.id, "menus.items.id", errors);
        if (item.documentId != null) assertString(item.documentId, "menus.items.documentId", errors);
        if (item.menuId != null) assertString(item.menuId, "menus.items.menuId", errors);
        if (item.appliedTagIds) assertStringArray(item.appliedTagIds, "menus.items.appliedTagIds", errors);
      }
    }
  }
}

async function run() {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("Usage: node tests/sanity-check.js <outputDir>");
    process.exit(1);
  }

  const entities = await loadSection(path.join(outputDir, "entities"));
  const indexes = await loadSection(path.join(outputDir, "indexes"));
  const views = await loadSection(path.join(outputDir, "views"));

  const { errors } = verifyOutputs({ entities, indexes, views });
  const typeErrors = [];
  checkForeignKeys(entities, typeErrors);

  const allErrors = [...errors, ...typeErrors];
  if (allErrors.length) {
    const preview = allErrors.slice(0, 10).join("; ");
    console.error(`Sanity check failed (${allErrors.length} issues). ${preview}`);
    process.exit(1);
  }

  console.log("Sanity check: ok");
}

run().catch((error) => {
  console.error(`Sanity check error: ${error?.message ?? error}`);
  process.exit(1);
});
