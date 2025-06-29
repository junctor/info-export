const LOCALE = "en-US";
const TZ = "America/Los_Angeles";

/**
 * Normalize raw events into enriched ScheduleEvent objects with tags and speaker info.
 * @param {Array<Object>} events - Raw event data
 * @param {Array<Object>} tags - Array of tagGroup objects, each with a `tags` array
 * @returns {Array<Object>} Processed events
 */
export const processScheduleData = (events, tags) => {
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  const allTags = tags?.flatMap((tagGroup) => tagGroup.tags) ?? [];
  const findSortOrder = (people, speakerId) =>
    people?.find((p) => p.person_id === speakerId)?.sort_order ?? null;

  return events.map((event) => {
    const matchedTags = event.tag_ids
      ?.map((tagId) => {
        const tag = allTags.find((t) => t.id === tagId);
        if (!tag) return null;
        return {
          id: tag.id,
          label: tag.label,
          color_background: tag.color_background,
          color_foreground: tag.color_foreground,
          sort_order: tag.sort_order,
        };
      })
      .filter((t) => t !== null)
      .sort((a, b) => a.sort_order - b.sort_order);

    const speakerNames = event.speakers?.map((s) => s.name) ?? [];

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      begin: event.begin,
      end: event.end,
      beginTimestampSeconds: event.begin_timestamp?.seconds ?? null,
      endTimestampSeconds: event.end_timestamp?.seconds ?? null,
      location: event.location?.name ?? null,
      color: event.type?.color ?? null,
      category: event.type?.name ?? null,
      tags: matchedTags,
      speakers: speakerNames.length ? formatter.format(speakerNames) : null,
      speaker_details:
        event.speakers?.map((s) => ({
          id: s.id,
          name: s.name,
          title: s.title ?? null,
          sort_order: findSortOrder(event.people, s.id),
        })) ?? [],
      links: event.links ?? [],
    };
  });
};

/**
 * Format a Date or timestamp into 'YYYY-MM-DD' in the America/Los_Angeles timezone.
 */
export function eventDay(time) {
  return new Date(time).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Internal helper to group by date
const groupedDates = (events) =>
  events
    .sort((a, b) => a.beginTimestampSeconds - b.beginTimestampSeconds)
    .reduce((group, event) => {
      const day = eventDay(event.beginTimestampSeconds * 1000);
      const dayEvents = group.get(day) ?? [];
      dayEvents.push(event);
      group.set(day, dayEvents);
      return group;
    }, new Map());

/**
 * Group processed events by day into a Map of YYYY-MM-DD → [events]
 */
export const createDateGroup = (events) =>
  new Map(
    Array.from(groupedDates(events)).map(([day, evts]) => [
      day,
      evts.sort((a, b) => a.beginTimestampSeconds - b.beginTimestampSeconds),
    ])
  );

/**
 * Process speaker profiles and attach minimal event info.
 */
export function processSpeakers(speakers, events) {
  const eventsMap = new Map(
    events.map((e) => [
      e.id,
      {
        id: e.id,
        title: e.title,
        begin: e.begin,
        end: e.end,
        location: { name: e.location.name },
        type: { color: e.type.color },
      },
    ])
  );

  return speakers
    .map((s) => ({
      id: s.id,
      name: s.name,
      affiliations: s.affiliations.map((a) => ({
        organization: a.organization,
        title: a.title,
      })),
      description: s.description,
      links: s.links.map((l) => ({
        sort_order: l.sort_order,
        title: l.title,
        url: l.url,
      })),
      event_ids: s.event_ids,
      media: s.media.map((m) => ({
        asset_id: m.asset_id,
        url: m.url,
        sort_order: m.sort_order,
      })),
      events: s.event_ids.map((id) => eventsMap.get(id)).filter(Boolean),
    }))
    .sort((a, b) => alphaSort(a.name, b.name));
}

/**
 * Process content items with sessions, tags, and people.
 */
export function processContentData(content, speakers, tags) {
  const speakerMap = new Map(speakers.map((sp) => [sp.id, sp.name]));
  const allTags = tags?.flatMap((tagGroup) => tagGroup.tags) ?? [];

  return content
    .map((item) => {
      const matchedTags = item.tag_ids
        ?.map((tagId) => allTags.find((t) => t.id === tagId))
        .filter((t) => t)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((tag) => ({
          id: tag.id,
          label: tag.label,
          color_background: tag.color_background,
          color_foreground: tag.color_foreground,
          sort_order: tag.sort_order,
        }));

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        sessions: item.sessions.map((s) => ({
          session_id: s.session_id,
          begin_tsz: s.begin_tsz,
          end_tsz: s.end_tsz,
          timezone_name: s.timezone_name,
          location_id: s.location_id,
        })),
        links: item.links,
        tags: matchedTags,
        people: item.people
          .map((p) => ({
            person_id: p.person_id,
            sort_order: p.sort_order,
            name: speakerMap.get(p.person_id),
          }))
          .filter((p) => p.name),
      };
    })
    .sort((a, b) => alphaSort(a.title, b.title));
}

/**
 * Build a unified search index across people, events, content, and organizations.
 */
export function createSearchData(events, speakers, content, organizations) {
  const raw = [
    ...speakers.map((s) => ({
      id: s.id,
      text: s.name,
      type: "person",
    })),
    ...events.map((e) => ({
      id: e.id,
      text: e.title,
      type: "event",
    })),
    ...content.map((c) => ({
      id: c.id,
      text: c.title,
      type: "content",
    })),
    ...organizations.map((o) => ({
      id: o.id,
      text: o.name,
      type: "organization",
    })),
  ].sort((a, b) => alphaSort(a.text, b.text));

  const uniqueMap = new Map();
  for (const item of raw) {
    const existing = uniqueMap.get(item.text);
    if (!existing || (existing.type === "content" && item.type === "event")) {
      uniqueMap.set(item.text, item);
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) =>
    alphaSort(a.value, b.value)
  );
}

/**
 * Build a map of tag.id → object containing tag metadata and a date-grouped schedule.
 * Uses processScheduleData internally.
 *
 * @param {Array<Object>} events - Raw event data
 * @param {Array<Object>} tags - Array of tagGroup objects with `tags` arrays
 * @returns {Object<number, {id, label, color_background, color_foreground, sort_order, schedule: Object<string, Array<Object>>}>}
 */
export function mapTagsToProcessedSchedule(events, tags) {
  const processed = processScheduleData(events, tags);
  const allTags = tags?.flatMap((group) => group.tags) ?? [];

  return allTags.reduce((acc, tag) => {
    const taggedEvents = processed.filter((evt) =>
      evt.tags.some((t) => t.id === tag.id)
    );
    const grouped = createDateGroup(taggedEvents);
    const schedule = Array.from(grouped).reduce((obj, [day, evts]) => {
      obj[day] = evts;
      return obj;
    }, {});

    acc[tag.id] = {
      id: tag.id,
      label: tag.label,
      color_background: tag.color_background,
      color_foreground: tag.color_foreground,
      sort_order: tag.sort_order,
      schedule,
    };
    return acc;
  }, {});
}

function cleanForSort(str) {
  return str?.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function alphaSort(a, b) {
  const cleanA = cleanForSort(a);
  const cleanB = cleanForSort(b);
  return cleanA?.localeCompare(cleanB);
}
