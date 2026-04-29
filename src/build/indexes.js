import { eventDay, formatMinuteKey } from "../time.js";
import { normalizeId } from "./schema.js";

function eventStartSeconds(event) {
  if (event?.beginTimestampSeconds != null) {
    return event.beginTimestampSeconds;
  }
  const ms = Date.parse(event?.begin);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function addToIndex(index, key, value) {
  if (key == null) return;
  const list = index[key] ?? [];
  list.push(value);
  index[key] = list;
}

function buildEventSortKeys(eventsById) {
  const sortKeys = {};
  for (const [eventId, event] of Object.entries(eventsById)) {
    sortKeys[eventId] = eventStartSeconds(event) ?? 0;
  }
  return sortKeys;
}

function sortIndexByEventStart(index, eventSortKeys) {
  for (const key of Object.keys(index)) {
    index[key] = index[key].sort((a, b) => {
      const aStart = eventSortKeys[a] ?? 0;
      const bStart = eventSortKeys[b] ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return a - b;
    });
  }
}

function sortContentIdsByTitle(index, contentById) {
  for (const key of Object.keys(index)) {
    index[key] = index[key].sort((a, b) => {
      const aTitle = contentById[a]?.title ?? "";
      const bTitle = contentById[b]?.title ?? "";
      const titleCompare = String(aTitle).localeCompare(String(bTitle), "en", {
        sensitivity: "base",
      });
      if (titleCompare !== 0) return titleCompare;
      return a - b;
    });
  }
}

export function buildIndexes({ entities, timeZone }) {
  const eventsById = entities.events.byId;
  const contentById = entities.content.byId;
  const eventSortKeys = buildEventSortKeys(eventsById);

  const eventsByDay = {};
  const eventsByStartMinute = {};
  const eventsByLocation = {};
  const eventsByPerson = {};
  const eventsByTag = {};
  const contentByTag = {};

  for (const eventId of entities.events.allIds) {
    const event = eventsById[eventId];
    if (!event) continue;

    const dayKey = eventDay(event.begin, timeZone);
    addToIndex(eventsByDay, dayKey, eventId);

    const minuteKey = formatMinuteKey(event.begin, timeZone);
    addToIndex(eventsByStartMinute, minuteKey, eventId);

    const locationId = normalizeId(event.locationId);
    if (locationId != null) {
      addToIndex(eventsByLocation, locationId, eventId);
    }

    const personIds = new Set();
    (event.speakerIds || []).forEach((id) => personIds.add(id));
    (event.personIds || []).forEach((id) => personIds.add(id));
    for (const personId of personIds) {
      addToIndex(eventsByPerson, personId, eventId);
    }

    for (const tagId of event.tagIds || []) {
      addToIndex(eventsByTag, tagId, eventId);
    }
  }

  for (const contentId of entities.content.allIds) {
    const item = contentById[contentId];
    if (!item) continue;
    for (const tagId of item.tagIds || []) {
      addToIndex(contentByTag, tagId, contentId);
    }
  }

  sortIndexByEventStart(eventsByDay, eventSortKeys);
  sortIndexByEventStart(eventsByStartMinute, eventSortKeys);
  sortIndexByEventStart(eventsByLocation, eventSortKeys);
  sortIndexByEventStart(eventsByPerson, eventSortKeys);
  sortIndexByEventStart(eventsByTag, eventSortKeys);

  sortContentIdsByTitle(contentByTag, contentById);

  return {
    indexes: {
      eventsByDay,
      eventsByStartMinute,
      eventsByLocation,
      eventsByPerson,
      eventsByTag,
      contentByTag,
    },
  };
}
