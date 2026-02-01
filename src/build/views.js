import { formatNameList } from "../normalize.js";
import { createSearchData } from "./search.js";

function compareStringsCaseInsensitive(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

function sortTags(a, b) {
  const aOrder = a.sortOrder ?? 0;
  const bOrder = b.sortOrder ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const labelCompare = String(a.label).localeCompare(String(b.label), "en");
  if (labelCompare !== 0) return labelCompare;
  return String(a.id).localeCompare(String(b.id), "en");
}

export function buildViews({ entities }) {
  if (!entities) {
    throw new Error("buildViews requires entities");
  }
  const eventsById = entities.events.byId;
  const tagsById = entities.tags.byId;
  const tagTypesById = entities.tagTypes.byId;
  const organizationsById = entities.organizations.byId;
  const locationsById = entities.locations.byId;
  const peopleById = entities.people.byId;
  const contentById = entities.content.byId;
  const documentsById = entities.documents.byId;

  const eventCardsById = {};

  for (const eventId of entities.events.allIds) {
    const event = eventsById[String(eventId)];
    if (!event) continue;

    const tags = (event.tagIds || [])
      .map((tagId) => tagsById[String(tagId)])
      .filter(Boolean)
      .sort(sortTags)
      .map((tag) => ({
        id: tag.id,
        label: tag.label,
        colorBackground: tag.colorBackground,
        colorForeground: tag.colorForeground,
      }));

    const speakerNameSet = new Set();
    for (const id of event.speakerIds || []) {
      const name = peopleById[String(id)]?.name;
      if (name) speakerNameSet.add(name);
    }
    for (const id of event.personIds || []) {
      const name = peopleById[String(id)]?.name;
      if (name) speakerNameSet.add(name);
    }

    const locationName =
      event.locationId != null
        ? (locationsById[String(event.locationId)]?.name ?? null)
        : null;

    eventCardsById[String(event.id)] = {
      id: event.id,
      contentId: event.contentId ?? null,
      title: event.title,
      begin: event.begin,
      end: event.end,
      color: event.color ?? null,
      location: locationName,
      speakers: formatNameList(Array.from(speakerNameSet)),
      tags,
    };
  }

  const organizationsCardsList = entities.organizations.allIds
    .map((orgId) => {
      const org = organizationsById[String(orgId)];
      if (!org) return null;
      const card = {
        id: org.id,
        name: org.name,
      };
      if (org.logoUrl) card.logoUrl = org.logoUrl;
      return {
        card,
        tagIds: Array.isArray(org.tagIds) ? org.tagIds : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const nameCompare = compareStringsCaseInsensitive(
        a.card.name,
        b.card.name,
      );
      if (nameCompare !== 0) return nameCompare;
      return String(a.card.id).localeCompare(String(b.card.id), "en");
    });

  const organizationsCards = {};
  for (const { card, tagIds } of organizationsCardsList) {
    const seenTags = new Set();
    let assigned = false;
    for (const tagId of tagIds) {
      if (tagId == null) continue;
      const key = String(tagId);
      if (seenTags.has(key)) continue;
      seenTags.add(key);
      const list = organizationsCards[key] ?? [];
      list.push(card);
      organizationsCards[key] = list;
      assigned = true;
    }
    if (!assigned) {
      const list = organizationsCards.uncategorized ?? [];
      list.push(card);
      organizationsCards.uncategorized = list;
    }
  }

  const peopleCards = entities.people.allIds
    .map((personId) => {
      const person = peopleById[String(personId)];
      if (!person) return null;
      const model = {
        id: person.id,
        name: person.name,
      };
      if (person.title) model.title = person.title;
      if (person.avatarUrl) model.avatarUrl = person.avatarUrl;
      return model;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const nameCompare = compareStringsCaseInsensitive(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;
      return String(a.id).localeCompare(String(b.id), "en");
    });

  const tagsByTypeId = {};
  for (const tagId of entities.tags.allIds) {
    const tag = tagsById[String(tagId)];
    if (!tag?.tagTypeId) continue;
    const typeId = String(tag.tagTypeId);
    const list = tagsByTypeId[typeId] ?? [];
    list.push({
      id: tag.id,
      label: tag.label,
      colorBackground: tag.colorBackground,
      colorForeground: tag.colorForeground,
      sortOrder: tag.sortOrder ?? null,
    });
    tagsByTypeId[typeId] = list;
  }

  const tagTypesBrowse = entities.tagTypes.allIds
    .map((typeId) => {
      const type = tagTypesById[String(typeId)];
      if (!type) return null;
      if (!type.isBrowsable) return null;
      if (type.category !== "content") return null;
      const tags = (tagsByTypeId[String(type.id)] ?? []).sort(sortTags);
      if (!tags.length) return null;
      return {
        id: type.id,
        label: type.label,
        category: type.category ?? null,
        sortOrder: type.sortOrder ?? null,
        tags,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aOrder = a.sortOrder ?? 0;
      const bOrder = b.sortOrder ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const labelCompare = String(a.label).localeCompare(String(b.label), "en");
      if (labelCompare !== 0) return labelCompare;
      return String(a.id).localeCompare(String(b.id), "en");
    });

  const documentsList = entities.documents.allIds
    .map((docId) => {
      const doc = documentsById[String(docId)];
      if (!doc) return null;
      return {
        id: doc.id,
        titleText: doc.titleText ?? null,
        updatedAtMs: doc.updatedAtMs ?? 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
      return String(a.id).localeCompare(String(b.id), "en");
    });

  const contentCards = entities.content.allIds
    .map((contentId) => {
      const item = contentById[String(contentId)];
      if (!item) return null;
      const tags = (item.tagIds || [])
        .map((tagId) => {
          const tag = tagsById[String(tagId)];
          if (!tag) return null;
          return {
            id: tag.id,
            label: tag.label,
            colorBackground: tag.colorBackground,
            colorForeground: tag.colorForeground,
          };
        })
        .filter(Boolean)
        .sort(sortTags);
      return {
        id: item.id,
        title: item.title,
        tags,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const titleCompare = compareStringsCaseInsensitive(a.title, b.title);
      if (titleCompare !== 0) return titleCompare;
      return String(a.id).localeCompare(String(b.id), "en");
    });

  const searchData = createSearchData(
    entities.people.allIds
      .map((personId) => peopleById[String(personId)])
      .filter(Boolean),
    entities.content.allIds
      .map((contentId) => contentById[String(contentId)])
      .filter(Boolean),
    entities.organizations.allIds
      .map((orgId) => organizationsById[String(orgId)])
      .filter(Boolean),
  );

  return {
    eventCardsById,
    organizationsCards,
    peopleCards,
    tagTypesBrowse,
    documentsList,
    contentCards,
    searchData,
  };
}
