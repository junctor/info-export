export const processScheduleData = (events, tags) => {
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });

  const allTags = tags?.flatMap((tagGroup) => tagGroup.tags) ?? [];

  // Helper to find speaker's sort_order from event.people[]
  const findSortOrder = (people, speakerId) =>
    people?.find((p) => p.person_id === speakerId)?.sort_order ?? null;

  return events.map((event) => {
    const matchedTags = event.tag_ids
      ?.map((tagId) => {
        const tag = allTags.find((tag) => tag.id === tagId);
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
      speakers: speakerNames.length > 0 ? formatter.format(speakerNames) : null,
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

export function eventDay(time) {
  // Format as YYYY-MM-DD in Vegas time
  return time.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const groupedDates = (events) =>
  events
    .sort((a, b) => a.beginTimestampSeconds - b.beginTimestampSeconds)
    .reduce((group, event) => {
      const day = eventDay(new Date(event.beginTimestampSeconds * 1000));
      const dayEvents = group.get(day) ?? [];
      dayEvents.push(event);
      group.set(day, dayEvents);
      return group;
    }, new Map());

export const createDateGroup = (events) =>
  new Map(
    Array.from(groupedDates(events)).map(([day, events]) => [
      day,
      events.sort((a, b) => a.beginTimestampSeconds - b.beginTimestampSeconds),
    ])
  );

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

  const minimalSpeakers = speakers
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
    .sort((a, b) => a.name.localeCompare(b.name));

  return minimalSpeakers;
}

export function processContentData(content, speakers, tags) {
  const speakerMap = new Map(speakers.map((sp) => [sp.id, sp.name]));
  const allTags = tags?.flatMap((tagGroup) => tagGroup.tags) ?? [];

  return content
    .map((item) => {
      const matchedTags = item.tag_ids
        ?.map((tagId) => {
          const tag = allTags.find((tag) => tag.id === tagId);
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
          .map((p) => {
            const name = speakerMap.get(p.person_id) || null;
            return {
              person_id: p.person_id,
              sort_order: p.sort_order,
              name,
            };
          })
          .filter((p) => p.name),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function createSearchData(events, speakers, content, organizations) {
  const raw = [
    ...speakers.map((s) => ({
      id: s.id,
      text: s.name,
      value: s.name.toLowerCase(),
      type: "person",
    })),
    ...events.map((e) => ({
      id: e.id,
      text: e.title,
      value: e.title.toLowerCase(),
      type: "event",
    })),
    ...content.map((c) => ({
      id: c.id,
      text: c.title,
      value: c.title.toLowerCase(),
      type: "content",
    })),
    ...organizations.map((o) => ({
      id: o.id,
      text: o.name,
      value: o.name.toLowerCase(),
      type: "organization",
    })),
  ];

  const uniqueMap = new Map();

  for (const item of raw) {
    const existing = uniqueMap.get(item.text);

    if (!existing || (existing.type === "content" && item.type === "event")) {
      uniqueMap.set(item.text, item);
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) =>
    a.value.localeCompare(b.value)
  );
}
