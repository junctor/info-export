import { eventDay } from "../time.js";

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

export function buildIndexes({ entities, timeZone }) {
  const eventsById = entities.events.byId;
  const eventSortKeys = buildEventSortKeys(eventsById);

  const eventsByDay = {};
  const eventsByTag = {};

  for (const eventId of entities.events.allIds) {
    const event = eventsById[eventId];
    if (!event) continue;

    const dayKey = eventDay(event.begin, timeZone);
    addToIndex(eventsByDay, dayKey, eventId);

    for (const tagId of event.tagIds || []) {
      addToIndex(eventsByTag, tagId, eventId);
    }
  }

  sortIndexByEventStart(eventsByDay, eventSortKeys);
  sortIndexByEventStart(eventsByTag, eventSortKeys);

  return {
    indexes: {
      eventsByDay,
      eventsByTag,
    },
  };
}
