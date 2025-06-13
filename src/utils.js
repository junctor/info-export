export const processScheduleData = (events, tags) => {
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });

  const allTags = tags?.flatMap((tagGroup) => tagGroup.tags) ?? [];

  return events.map((event) => {
    const matchedTags =
      event.tag_ids
        ?.map((tagId) => allTags.find((tag) => tag.id === tagId))
        .filter(Boolean) ?? [];

    const speakerNames = event.speakers?.map((s) => s.name) ?? [];

    return {
      id: event.id,
      begin: event.begin,
      beginTimestampSeconds: event.begin_timestamp?.seconds ?? 0,
      end: event.end,
      endTimestampSeconds: event.end_timestamp?.seconds ?? 0,
      title: event.title,
      location: event.location?.name ?? "Unknown Location",
      color: event.type?.color ?? "#000000",
      category: event.type?.name ?? "Uncategorized",
      tags: matchedTags,
      speakers: speakerNames.length > 0 ? formatter.format(speakerNames) : null,
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
