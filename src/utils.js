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
