export const processScheduleData = (events, tags) => {
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });

  const allTags = tags?.flatMap((t) => t.tags) ?? [];

  return events.map((e) => ({
    id: e.id,
    begin: e.begin,
    beginTimestampSeconds: e.begin_timestamp.seconds,
    end: e.end,
    endTimestampSeconds: e.end_timestamp.seconds,
    title: e.title,
    location: e.location.name,
    color: e.type.color,
    category: e.type.name,
    tags:
      e.tag_ids
        .map((t) => allTags.find((a) => a.id === t))
        .filter((tag) => tag !== undefined) ?? [],
    speakers: formatter.format(e.speakers.map((s) => s.name)),
  }));
};

