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
  const resolvedKey = normalizeId(key);
  if (!resolvedKey) return;
  const list = index[resolvedKey] ?? [];
  list.push(value);
  index[resolvedKey] = list;
}

function sortIndexByEventStart(index, eventsById) {
  for (const key of Object.keys(index)) {
    index[key] = index[key].sort((a, b) => {
      const aEvent = eventsById[String(a)];
      const bEvent = eventsById[String(b)];
      const aStart = eventStartSeconds(aEvent) ?? 0;
      const bStart = eventStartSeconds(bEvent) ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return String(a).localeCompare(String(b), "en");
    });
  }
}

function sortContentIdsByTitle(index, contentById) {
  for (const key of Object.keys(index)) {
    index[key] = index[key].sort((a, b) => {
      const aTitle = contentById[String(a)]?.title ?? "";
      const bTitle = contentById[String(b)]?.title ?? "";
      const titleCompare = String(aTitle).localeCompare(String(bTitle), "en", {
        sensitivity: "base",
      });
      if (titleCompare !== 0) return titleCompare;
      return String(a).localeCompare(String(b), "en");
    });
  }
}

export function buildIndexes({ entities, timeZone }) {
  if (!entities?.events?.allIds || !entities?.events?.byId) {
    throw new Error("buildIndexes requires entities.events store");
  }
  if (!entities?.content?.allIds || !entities?.content?.byId) {
    throw new Error("buildIndexes requires entities.content store");
  }
  const eventsById = entities.events.byId;
  const contentById = entities.content.byId;

  const eventsByDay = {};
  const eventsByStartMinute = {};
  const eventsByLocation = {};
  const eventsByPerson = {};
  const eventsByTag = {};
  const contentByTag = {};

  for (const eventId of entities.events.allIds) {
    const event = eventsById[String(eventId)];
    if (!event) continue;

    const dayKey = eventDay(event.begin, timeZone);
    addToIndex(eventsByDay, dayKey, eventId);

    const minuteKey = formatMinuteKey(event.begin, timeZone);
    addToIndex(eventsByStartMinute, minuteKey, eventId);

    const locationId = event.locationId != null ? String(event.locationId) : null;
    if (locationId) {
      addToIndex(eventsByLocation, locationId, eventId);
    }

    const personIds = new Set();
    (event.speakerIds || []).forEach((id) => personIds.add(String(id)));
    (event.personIds || []).forEach((id) => personIds.add(String(id)));
    for (const personId of personIds) {
      addToIndex(eventsByPerson, personId, eventId);
    }

    for (const tagId of event.tagIds || []) {
      addToIndex(eventsByTag, String(tagId), eventId);
    }
  }

  for (const contentId of entities.content.allIds) {
    const item = contentById[String(contentId)];
    if (!item) continue;
    for (const tagId of item.tagIds || []) {
      addToIndex(contentByTag, String(tagId), contentId);
    }
  }

  sortIndexByEventStart(eventsByDay, eventsById);
  sortIndexByEventStart(eventsByStartMinute, eventsById);
  sortIndexByEventStart(eventsByLocation, eventsById);
  sortIndexByEventStart(eventsByPerson, eventsById);
  sortIndexByEventStart(eventsByTag, eventsById);

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
