import { createSearchData } from "./search.js";
import { eventDay, eventTimeTable } from "../time.js";

function compareStringsCaseInsensitive(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

function sortTags(a, b) {
  const aOrder = a.sortOrder ?? 0;
  const bOrder = b.sortOrder ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const labelCompare = String(a.label).localeCompare(String(b.label), "en");
  if (labelCompare !== 0) return labelCompare;
  return a.id - b.id;
}

function timestampSeconds(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function compareEventsByBegin(a, b) {
  const aStart = timestampSeconds(a?.begin);
  const bStart = timestampSeconds(b?.begin);
  if (aStart !== bStart) return aStart - bStart;
  return (a?.id ?? 0) - (b?.id ?? 0);
}

function sortedIds(ids) {
  return (ids || []).slice().sort((a, b) => a - b);
}

function pushUniqueEntity(list, seenIds, byId, id) {
  if (id == null) return;
  if (seenIds.has(id)) return;
  const entity = byId[id];
  if (!entity) return;
  seenIds.add(id);
  list.push(entity);
}

function entitiesForIds(ids, byId) {
  const list = [];
  const seenIds = new Set();
  for (const id of ids || []) {
    pushUniqueEntity(list, seenIds, byId, id);
  }
  return list;
}

function compactTag(tag) {
  return {
    id: tag.id,
    label: tag.label,
    colorBackground: tag.colorBackground,
    colorForeground: tag.colorForeground,
  };
}

function displayTime(event, field, showTz, timeZone) {
  if (event?.[field]) return event[field];
  const source = field.startsWith("begin") ? event?.begin : event?.end;
  return source ? eventTimeTable(source, showTz, timeZone) : "";
}

function isoTime(event, field) {
  if (event?.[field]) return event[field];
  const source = field.startsWith("begin") ? event?.begin : event?.end;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function buildScheduleEventViewModel(
  event,
  { contentById, locationsById, peopleById, tagsById },
  timeZone,
) {
  const speakerIds =
    Array.isArray(event.speakerIds) && event.speakerIds.length ? event.speakerIds : event.personIds;
  const speakerNames = (speakerIds || [])
    .map((personId) => peopleById[personId]?.name)
    .filter(Boolean);
  const contentEntity = event.contentId == null ? null : (contentById[event.contentId] ?? null);

  return {
    id: event.id,
    title: event.title,
    begin: event.begin,
    end: event.end,
    beginTimestampSeconds: timestampSeconds(event.begin),
    endTimestampSeconds: timestampSeconds(event.end),
    color: event.color ?? "",
    contentId: event.contentId,
    contentEntity,
    session: event,
    locationName: locationsById[event.locationId]?.name ?? "Unknown location",
    tags: (event.tagIds || [])
      .map((tagId) => tagsById[tagId])
      .filter(Boolean)
      .map(compactTag),
    speakers: speakerNames.length ? speakerNames.join(", ") : null,
    beginDisplay: displayTime(event, "beginDisplay", true, timeZone),
    beginIso: isoTime(event, "beginIso"),
    endDisplay: displayTime(event, "endDisplay", false, timeZone),
    endIso: isoTime(event, "endIso"),
  };
}

function groupEventsByDay(events, timeZone) {
  const groups = {};
  for (const event of events) {
    const day = eventDay(event.begin, timeZone);
    if (!day) continue;
    const list = groups[day] ?? [];
    list.push(event);
    groups[day] = list;
  }
  return groups;
}

function buildScheduleDaysFromEvents(events, modelsByEventId, timeZone) {
  const groups = groupEventsByDay(events, timeZone);
  return Object.keys(groups)
    .sort()
    .map((day) => ({
      day,
      events: groups[day]
        .slice()
        .sort(compareEventsByBegin)
        .map((event) => modelsByEventId[event.id])
        .filter(Boolean),
    }))
    .filter((day) => day.events.length);
}

function eventsFromIndex(index, eventsById) {
  return (index || []).map((eventId) => eventsById[eventId]).filter(Boolean);
}

function buildAllScheduleDays({ entities, indexes, modelsByEventId, timeZone }) {
  const eventsByDay = indexes?.eventsByDay ?? {};
  const dayKeys = Object.keys(eventsByDay);
  if (!dayKeys.length) {
    const allEvents = entities.events.allIds
      .map((eventId) => entities.events.byId[eventId])
      .filter(Boolean);
    return buildScheduleDaysFromEvents(allEvents, modelsByEventId, timeZone);
  }

  return dayKeys
    .sort()
    .map((day) => ({
      day,
      events: eventsFromIndex(eventsByDay[day], entities.events.byId)
        .sort(compareEventsByBegin)
        .map((event) => modelsByEventId[event.id])
        .filter(Boolean),
    }))
    .filter((day) => day.events.length);
}

function eventIdsForTag(tagId, { entities, indexes }) {
  const indexed = indexes?.eventsByTag?.[tagId];
  if (Array.isArray(indexed)) return indexed;
  return entities.events.allIds.filter((eventId) => {
    const event = entities.events.byId[eventId];
    return event?.tagIds?.includes(tagId);
  });
}

function uniqueLocationsForEvents(events, locationsById) {
  const locations = [];
  const seenLocationIds = new Set();
  for (const event of events) {
    pushUniqueEntity(locations, seenLocationIds, locationsById, event.locationId);
  }
  return locations;
}

function buildContentDetail(
  content,
  { eventsById, locationsById, peopleById, tagsById, allEvents },
) {
  const sessionIds =
    Array.isArray(content.sessions) && content.sessions.length ? content.sessions : null;
  const sessions = (
    sessionIds
      ? sessionIds.map((eventId) => eventsById[eventId]).filter(Boolean)
      : allEvents.filter((event) => event.contentId === content.id)
  ).sort(compareEventsByBegin);

  const locations = uniqueLocationsForEvents(sessions, locationsById);

  let people = [];
  if (Array.isArray(content.people) && content.people.length) {
    people = content.people
      .slice()
      .sort((a, b) => {
        const aOrder = a.sortOrder;
        const bOrder = b.sortOrder;
        if (aOrder !== bOrder) {
          if (aOrder == null) return 1;
          if (bOrder == null) return -1;
          return aOrder - bOrder;
        }
        return (a.personId ?? 0) - (b.personId ?? 0);
      })
      .map((person) => peopleById[person.personId])
      .filter(Boolean);
  } else {
    const peopleIds = [];
    for (const session of sessions) {
      peopleIds.push(...(session.speakerIds || []), ...(session.personIds || []));
    }
    people = entitiesForIds(peopleIds, peopleById);
  }

  return {
    content,
    sessions,
    locations,
    people,
    tags: entitiesForIds(content.tagIds || [], tagsById),
  };
}

function buildPersonDetail(person, { contentById, eventsById, allEvents, locationsById }) {
  const events = [];
  const seenEventIds = new Set();

  for (const contentId of person.contentIds || []) {
    const content = contentById[contentId];
    for (const eventId of content?.sessions || []) {
      const event = eventsById[eventId];
      if (!event || seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      events.push(event);
    }
    for (const event of allEvents) {
      if (event.contentId !== contentId || seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      events.push(event);
    }
  }

  for (const event of allEvents) {
    const eventPersonIds = [...(event.speakerIds || []), ...(event.personIds || [])];
    if (!eventPersonIds.includes(person.id) || seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);
    events.push(event);
  }

  events.sort(compareEventsByBegin);

  return {
    person,
    events,
    locations: uniqueLocationsForEvents(events, locationsById),
  };
}

export function buildViews({ entities }) {
  const tagsById = entities.tags.byId;
  const tagTypesById = entities.tagTypes.byId;
  const organizationsById = entities.organizations.byId;
  const peopleById = entities.people.byId;
  const contentById = entities.content.byId;
  const documentsById = entities.documents.byId;

  const organizationsCardsList = entities.organizations.allIds
    .map((orgId) => {
      const org = organizationsById[orgId];
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
      const nameCompare = compareStringsCaseInsensitive(a.card.name, b.card.name);
      if (nameCompare !== 0) return nameCompare;
      return a.card.id - b.card.id;
    });

  const organizationsCards = {};
  for (const { card, tagIds } of organizationsCardsList) {
    const seenTags = new Set();
    let assigned = false;
    for (const tagId of tagIds) {
      if (tagId == null) continue;
      if (seenTags.has(tagId)) continue;
      seenTags.add(tagId);
      const list = organizationsCards[tagId] ?? [];
      list.push(card);
      organizationsCards[tagId] = list;
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
      const person = peopleById[personId];
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
      return a.id - b.id;
    });

  const tagsByTypeId = {};
  for (const tagId of entities.tags.allIds) {
    const tag = tagsById[tagId];
    if (!tag?.tagTypeId) continue;
    const typeId = tag.tagTypeId;
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
      const type = tagTypesById[typeId];
      if (!type) return null;
      if (!type.isBrowsable) return null;
      if (type.category !== "content") return null;
      const tags = (tagsByTypeId[type.id] ?? []).sort(sortTags);
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
      return a.id - b.id;
    });

  const documentsList = entities.documents.allIds
    .map((docId) => {
      const doc = documentsById[docId];
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
      return a.id - b.id;
    });

  const contentCards = entities.content.allIds
    .map((contentId) => {
      const item = contentById[contentId];
      if (!item) return null;
      const tags = (item.tagIds || [])
        .map((tagId) => {
          const tag = tagsById[tagId];
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
      return a.id - b.id;
    });

  const searchData = createSearchData(
    entities.people.allIds.map((personId) => peopleById[personId]).filter(Boolean),
    entities.content.allIds.map((contentId) => contentById[contentId]).filter(Boolean),
    entities.organizations.allIds.map((orgId) => organizationsById[orgId]).filter(Boolean),
  );

  return {
    organizationsCards,
    peopleCards,
    tagTypesBrowse,
    documentsList,
    contentCards,
    searchData,
  };
}

export function buildPageReadyArtifacts({ entities, indexes = {}, timeZone }) {
  const allEvents = entities.events.allIds
    .map((eventId) => entities.events.byId[eventId])
    .filter(Boolean);
  const lookup = {
    contentById: entities.content.byId,
    locationsById: entities.locations.byId,
    peopleById: entities.people.byId,
    tagsById: entities.tags.byId,
  };
  const modelsByEventId = {};
  for (const event of allEvents) {
    modelsByEventId[event.id] = buildScheduleEventViewModel(event, lookup, timeZone);
  }

  const scheduleDays = buildAllScheduleDays({
    entities,
    indexes,
    modelsByEventId,
    timeZone,
  });

  const bookmarkEventsById = {};
  for (const eventId of sortedIds(entities.events.allIds)) {
    if (!modelsByEventId[eventId]) continue;
    bookmarkEventsById[eventId] = modelsByEventId[eventId];
  }

  const locationCards = entities.locations.allIds
    .map((locationId) => entities.locations.byId[locationId])
    .filter(Boolean)
    .map((location) => ({
      id: location.id,
      name: location.name,
      shortName: location.shortName,
      parentId: location.parentId,
    }));

  const announcementsList = entities.articles.allIds
    .map((articleId) => entities.articles.byId[articleId])
    .filter(Boolean)
    .sort((a, b) => {
      const aUpdated = a.updatedAtMs ?? 0;
      const bUpdated = b.updatedAtMs ?? 0;
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return a.id - b.id;
    });

  const detailLookup = {
    ...lookup,
    eventsById: entities.events.byId,
    allEvents,
  };

  const content = {};
  for (const contentId of sortedIds(entities.content.allIds)) {
    const item = entities.content.byId[contentId];
    if (!item) continue;
    content[contentId] = buildContentDetail(item, detailLookup);
  }

  const people = {};
  for (const personId of sortedIds(entities.people.allIds)) {
    const person = entities.people.byId[personId];
    if (!person) continue;
    people[personId] = buildPersonDetail(person, detailLookup);
  }

  const tags = {};
  for (const tagId of sortedIds(entities.tags.allIds)) {
    const tag = entities.tags.byId[tagId];
    if (!tag) continue;
    tags[tagId] = {
      tag,
      days: buildScheduleDaysFromEvents(
        eventsFromIndex(eventIdsForTag(tagId, { entities, indexes }), entities.events.byId),
        modelsByEventId,
        timeZone,
      ),
    };
  }

  const locations = {};
  for (const locationId of sortedIds(entities.locations.allIds)) {
    const location = entities.locations.byId[locationId];
    if (!location) continue;
    locations[locationId] = {
      location,
      days: buildScheduleDaysFromEvents(
        allEvents.filter((event) => event.locationId === location.id),
        modelsByEventId,
        timeZone,
      ),
    };
  }

  const documents = {};
  for (const documentId of sortedIds(entities.documents.allIds)) {
    const document = entities.documents.byId[documentId];
    if (!document) continue;
    documents[documentId] = document;
  }

  const organizations = {};
  for (const organizationId of sortedIds(entities.organizations.allIds)) {
    const organization = entities.organizations.byId[organizationId];
    if (!organization) continue;
    organizations[organizationId] = organization;
  }

  return {
    views: {
      scheduleDays,
      bookmarkEventsById,
      locationCards,
      announcementsList,
    },
    details: {
      content,
      people,
      tags,
      locations,
      documents,
      organizations,
    },
  };
}
