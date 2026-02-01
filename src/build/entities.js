import {
  buildEntityMap,
  normalizeId,
  resolveUpdatedAtMs,
  sortById,
  uniqAndFilterIds,
} from "./schema.js";

function buildEventModel(event, refs) {
  const speakerIds = uniqAndFilterIds(
    (event.speakers || []).map((speaker) => speaker?.id),
    refs.personIds,
  ).sort((a, b) => a - b);
  const personIds = uniqAndFilterIds(
    (event.people || []).map((person) => person?.person_id),
    refs.personIds,
  ).sort((a, b) => a - b);
  const tagIds = uniqAndFilterIds(event.tag_ids || [], refs.tagIds).sort(
    (a, b) => a - b,
  );

  const locationId = normalizeId(
    event.location?.id ?? event.location_id ?? null,
  );
  const resolvedLocationId =
    locationId != null && refs.locationIds.has(locationId) ? locationId : null;
  const contentId = normalizeId(event.content_id ?? null);
  const resolvedContentId =
    contentId != null && refs.contentIds.has(contentId) ? contentId : null;

  const color = event.type?.color ?? null;

  const model = {
    id: normalizeId(event.id),
    title: event.title,
    contentId: resolvedContentId,
    begin: event.begin_tsz,
    end: event.end_tsz,
    locationId: resolvedLocationId,
  };
  if (model.id == null) {
    throw new Error("Event missing id");
  }

  if (speakerIds.length) model.speakerIds = speakerIds;
  if (personIds.length) model.personIds = personIds;
  if (tagIds.length) model.tagIds = tagIds;
  if (color) model.color = color;

  return model;
}

function buildTags(tagTypes) {
  const tags = tagTypes.flatMap((group) =>
    (group.tags || []).map((tag) => ({
      id: normalizeId(tag.id),
      label: tag.label,
      colorBackground: tag.color_background,
      colorForeground: tag.color_foreground,
      sortOrder: tag.sort_order ?? null,
      tagTypeId: normalizeId(group.id),
    })),
  );

  return tags.sort((a, b) => {
    const aOrder = a.sortOrder ?? 0;
    const bOrder = b.sortOrder ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const labelCompare = String(a.label).localeCompare(String(b.label), "en");
    if (labelCompare !== 0) return labelCompare;
    return sortById(a, b);
  });
}

export function buildEntities(dataMap) {
  if (!dataMap) {
    throw new Error("buildEntities requires dataMap");
  }
  const requiredKeys = [
    "locations",
    "speakers",
    "tagtypes",
    "content",
    "events",
    "organizations",
    "articles",
    "documents",
    "menus",
  ];
  for (const key of requiredKeys) {
    if (!Array.isArray(dataMap[key])) {
      throw new Error(`buildEntities requires dataMap.${key} array`);
    }
  }

  const refs = {
    locationIds: new Set(
      dataMap.locations
        .map((loc) => normalizeId(loc.id))
        .filter(Number.isFinite),
    ),
    personIds: new Set(
      dataMap.speakers
        .map((person) => normalizeId(person.id))
        .filter(Number.isFinite),
    ),
    tagIds: new Set(
      dataMap.tagtypes.flatMap((group) =>
        (group.tags || [])
          .map((tag) => normalizeId(tag.id))
          .filter(Number.isFinite),
      ),
    ),
    contentIds: new Set(
      dataMap.content
        .map((item) => normalizeId(item.id))
        .filter(Number.isFinite),
    ),
  };

  const events = dataMap.events.map((event) => buildEventModel(event, refs));
  const tags = buildTags(dataMap.tagtypes);

  return {
    events: buildEntityMap(events),
    content: buildEntityMap(
      dataMap.content.map((item) => {
        const tagIds = uniqAndFilterIds(item.tag_ids || [], refs.tagIds);
        const peopleEntries = (item.people || [])
          .filter((person) => person?.person_id != null)
          .map((person) => ({
            ...person,
            person_id: normalizeId(person.person_id),
          }))
          .filter((person) => Number.isFinite(person.person_id))
          .filter((person) => refs.personIds.has(person.person_id));
        const peopleIds = uniqAndFilterIds(
          peopleEntries.map((person) => person.person_id),
        );
        const peopleOrderById = new Map(
          peopleEntries.map((person) => [
            person.person_id,
            person.sort_order ?? null,
          ]),
        );

        const sessions = uniqAndFilterIds(
          (item.sessions || []).map((session) => session.session_id),
        ).sort((a, b) => a - b);

        const model = {
          id: normalizeId(item.id),
          title: item.title,
          sessions: sessions,
        };
        if (model.id == null) {
          throw new Error("Content item missing id");
        }
        if (tagIds.length) {
          model.tagIds = tagIds.sort((a, b) => a - b);
        }
        if (peopleIds.length) {
          const sortedPeopleIds = peopleIds.sort((a, b) => {
            const aOrder = peopleOrderById.get(a);
            const bOrder = peopleOrderById.get(b);
            if (aOrder !== bOrder) {
              if (aOrder == null) return 1;
              if (bOrder == null) return -1;
              return aOrder - bOrder;
            }
            return a - b;
          });
          model.people = sortedPeopleIds.map((personId) => ({
            personId,
            sortOrder: peopleOrderById.get(personId) ?? null,
          }));
        }
        return model;
      }),
    ),
    people: buildEntityMap(
      dataMap.speakers.map((person) => {
        const model = {
          id: normalizeId(person.id),
          name: person.name,
          contentIds: uniqAndFilterIds(
            person.content_ids || [],
            refs.contentIds,
          ).sort((a, b) => a - b),
        };
        if (model.id == null) {
          throw new Error("Person missing id");
        }
        if (person.description) model.description = person.description;
        if (person.pronouns) model.pronouns = person.pronouns;
        if (person.title) model.title = person.title;
        if (person.affiliations?.length > 0)
          model.affiliations = person.affiliations;
        if (person.avatar) model.avatarUrl = person.avatar.url;
        if (person.links?.length > 0) model.links = person.links;
        return model;
      }),
    ),
    locations: buildEntityMap(
      dataMap.locations.map((location) => ({
        id: normalizeId(location.id),
        name: location.name,
        shortName: location.short_name ?? null,
        parentId: normalizeId(location.parent_id ?? null),
      })),
    ),
    organizations: buildEntityMap(
      dataMap.organizations.map((org) => {
        const logoUrl = org.logo?.url ?? null;
        const tagIds = uniqAndFilterIds(org.tag_ids || [], refs.tagIds).sort(
          (a, b) => a - b,
        );

        const model = {
          id: normalizeId(org.id),
          name: org.name,
          description: org.description ?? "TBD",
          links: org.links || [],
          tagIdAsOrganizer: normalizeId(org.tag_id_as_organizer),
        };
        if (model.id == null) {
          throw new Error("Organization missing id");
        }
        if (logoUrl) model.logoUrl = logoUrl;
        if (tagIds.length) model.tagIds = tagIds;
        return model;
      }),
    ),
    tags: buildEntityMap(tags),
    tagTypes: buildEntityMap(
      dataMap.tagtypes.map((tagType) => ({
        id: normalizeId(tagType.id),
        label: tagType.label,
        category: tagType.category ?? null,
        sortOrder: tagType.sort_order ?? null,
        isBrowsable: Boolean(tagType.is_browsable),
      })),
    ),
    articles: buildEntityMap(
      dataMap.articles.map((article) => ({
        id: normalizeId(article.id),
        name: article.name,
        text: article.text ?? null,
        updatedAtMs: resolveUpdatedAtMs(article),
      })),
    ),
    documents: buildEntityMap(
      dataMap.documents.map((doc) => {
        const updatedAtMs = resolveUpdatedAtMs(doc);
        const model = {
          id: normalizeId(doc.id),
          titleText: doc.title_text ?? null,
          bodyText: doc.body_text ?? null,
        };
        if (model.id == null) {
          throw new Error("Document missing id");
        }
        if (updatedAtMs != null) model.updatedAtMs = updatedAtMs;
        return model;
      }),
    ),
    menus: buildEntityMap(
      dataMap.menus.map((menu) => ({
        id: normalizeId(menu.id),
        titleText: menu.title_text ?? null,
        items: Array.isArray(menu.items)
          ? menu.items
              .map((item) => ({
                id: normalizeId(item?.id),
                titleText: item?.title_text ?? null,
                function: item?.function ?? null,
                sortOrder: item?.sort_order ?? null,
                documentId: normalizeId(item?.document_id ?? null),
                menuId: normalizeId(item?.menu_id ?? null),
                appliedTagIds: uniqAndFilterIds(
                  item?.applied_tag_ids || [],
                ).sort((a, b) => a - b),
                googleMaterialSymbol: item?.google_materialsymbol ?? null,
                appleSfSymbol: item?.apple_sfsymbol ?? null,
                prohibitTagFilter: item?.prohibit_tag_filter === "Y",
              }))
              .filter((item) => item.id != null)
              .sort((a, b) => {
                const aOrder = a.sortOrder ?? Infinity;
                const bOrder = b.sortOrder ?? Infinity;
                if (aOrder !== bOrder) return aOrder - bOrder;
                const titleCompare = String(a.titleText).localeCompare(
                  String(b.titleText),
                  "en",
                );
                if (titleCompare !== 0) return titleCompare;
                return a.id - b.id;
              })
          : [],
      })),
    ),
  };
}
