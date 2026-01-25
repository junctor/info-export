import { isValidTimeZone } from "./time.js";

function countMissingRefs(ids, validSet) {
  let missing = 0;
  for (const id of ids) {
    if (id == null) continue;
    if (!validSet.has(String(id))) missing += 1;
  }
  return missing;
}

function isMissingOrInvalidDate(value) {
  if (!value) return true;
  return Number.isNaN(new Date(value).getTime());
}

function parseDateMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function validateData({ dataMap, timeZone }) {
  const warnings = [];

  const invalidTimezone = Boolean(timeZone && !isValidTimeZone(timeZone));
  if (invalidTimezone) warnings.push(`invalid timezone "${timeZone}"`);

  const locationIds = new Set(dataMap.locations.map((loc) => String(loc.id)));
  const personIds = new Set(dataMap.speakers.map((person) => String(person.id)));
  const tagIds = new Set(
    dataMap.tagtypes.flatMap((group) =>
      (group.tags || []).map((tag) => String(tag.id)),
    ),
  );
  const contentIds = new Set(dataMap.content.map((item) => String(item.id)));

  let missingEventLocations = 0;
  let missingEventPeople = 0;
  let missingEventTags = 0;
  let missingEventContent = 0;
  let missingEventBegin = 0;
  let missingEventEnd = 0;
  let invalidEventRanges = 0;

  for (const event of dataMap.events) {
    const locationId = event.location?.id ?? event.location_id ?? null;
    if (locationId == null || !locationIds.has(String(locationId))) {
      missingEventLocations += 1;
    }

    const speakerIds = (event.speakers || []).map((s) => s?.id);
    const personRefs = (event.people || []).map((p) => p?.person_id);
    missingEventPeople += countMissingRefs(
      [...speakerIds, ...personRefs],
      personIds,
    );

    missingEventTags += countMissingRefs(event.tag_ids || [], tagIds);

    if (event.content_id != null && !contentIds.has(String(event.content_id))) {
      missingEventContent += 1;
    }

    if (isMissingOrInvalidDate(event.begin)) missingEventBegin += 1;
    if (isMissingOrInvalidDate(event.end)) missingEventEnd += 1;

    const beginMs = parseDateMs(event.begin);
    const endMs = parseDateMs(event.end);
    if (beginMs != null && endMs != null && beginMs >= endMs) {
      invalidEventRanges += 1;
    }
  }

  if (missingEventLocations) {
    warnings.push(`events missing locations: ${missingEventLocations}`);
  }
  if (missingEventPeople) {
    warnings.push(`events missing people: ${missingEventPeople}`);
  }
  if (missingEventTags) {
    warnings.push(`events missing tags: ${missingEventTags}`);
  }
  if (missingEventContent) {
    warnings.push(`events missing content: ${missingEventContent}`);
  }
  if (missingEventBegin) {
    warnings.push(`events missing/invalid begin: ${missingEventBegin}`);
  }
  if (missingEventEnd) {
    warnings.push(`events missing/invalid end: ${missingEventEnd}`);
  }
  if (invalidEventRanges) {
    warnings.push(`events begin>=end: ${invalidEventRanges}`);
  }

  let missingContentTags = 0;
  let missingContentPeople = 0;

  for (const item of dataMap.content) {
    missingContentTags += countMissingRefs(item.tag_ids || [], tagIds);
    const peopleIds = (item.people || []).map((p) => p?.person_id);
    missingContentPeople += countMissingRefs(peopleIds, personIds);
  }

  if (missingContentTags) {
    warnings.push(`content missing tags: ${missingContentTags}`);
  }
  if (missingContentPeople) {
    warnings.push(`content missing people: ${missingContentPeople}`);
  }

  return {
    warnings,
    summary: {
      timezone: timeZone ?? null,
      invalidTimezone,
      missingEventLocations,
      missingEventPeople,
      missingEventTags,
      missingEventContent,
      missingEventBegin,
      missingEventEnd,
      invalidEventRanges,
      missingContentTags,
      missingContentPeople,
    },
  };
}
