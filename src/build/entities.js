import {
  getEventEndTimestampSeconds,
  getEventTimestampSeconds,
} from "../time.js";

function sortById(a, b) {
  return String(a.id).localeCompare(String(b.id), "en");
}

function buildEntityMap(items) {
  const sorted = items.slice().sort(sortById);
  const byId = {};
  const allIds = [];
  for (const item of sorted) {
    const id = String(item.id);
    byId[id] = item;
    allIds.push(item.id);
  }
  return { allIds, byId };
}

function uniqAndFilter(ids, validSet) {
  const seen = new Set();
  const next = [];
  for (const id of ids) {
    if (id == null) continue;
    const key = String(id);
    if (validSet && !validSet.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(id);
  }
  return next;
}

function normalizeAffiliations(affiliations) {
  if (!Array.isArray(affiliations)) return [];
  const seen = new Set();
  const names = [];
  for (const entry of affiliations) {
    const name = entry?.organization;
    if (!name) continue;
    const cleaned = String(name).trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
  }
  return names;
}

function resolveUpdatedAtMs(item) {
  if (item?.updated_at?.seconds != null) {
    return item.updated_at.seconds * 1000;
  }
  if (typeof item?.updated_at === "string") {
    const ms = Date.parse(item.updated_at);
    return Number.isFinite(ms) ? ms : null;
  }
  if (item?.updated_at?.toDate) {
    return item.updated_at.toDate().getTime();
  }
  if (typeof item?.updated_tsz === "string") {
    const ms = Date.parse(item.updated_tsz);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof item?.updated_at_str === "string") {
    const ms = Date.parse(item.updated_at_str);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function buildEventModel(event, refs) {
  const speakerIds = uniqAndFilter(
    (event.speakers || []).map((s) => s?.id),
    refs.personIds,
  );
  const personIds = uniqAndFilter(
    (event.people || []).map((person) => person?.person_id),
    refs.personIds,
  );
  const tagIds = uniqAndFilter(event.tag_ids || [], refs.tagIds);

  const locationId = event.location?.id ?? event.location_id ?? null;
  const resolvedLocationId =
    locationId != null && refs.locationIds.has(String(locationId))
      ? locationId
      : null;
  const resolvedContentId =
    event.content_id != null && refs.contentIds.has(String(event.content_id))
      ? event.content_id
      : null;

  const beginTimestampSeconds = getEventTimestampSeconds(event);
  const endTimestampSeconds = getEventEndTimestampSeconds(event);
  const color = event.type?.color ?? null;

  const model = {
    id: event.id,
    title: event.title,
    content_id: resolvedContentId,
    begin: event.begin,
    end: event.end,
    location_id: resolvedLocationId,
  };

  if (beginTimestampSeconds != null) {
    model.beginTimestampSeconds = beginTimestampSeconds;
  }
  if (endTimestampSeconds != null) {
    model.endTimestampSeconds = endTimestampSeconds;
  }
  if (speakerIds.length) model.speakerIds = speakerIds;
  if (personIds.length) model.personIds = personIds;
  if (tagIds.length) model.tag_ids = tagIds;
  if (color) model.color = color;

  return model;
}

function buildTags(tagTypes) {
  const tags = tagTypes.flatMap((group) =>
    (group.tags || []).map((tag) => ({
      id: tag.id,
      label: tag.label,
      color_background: tag.color_background,
      color_foreground: tag.color_foreground,
      sort_order: tag.sort_order,
      tagtype_id: group.id,
    })),
  );

  return tags.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const labelCompare = String(a.label).localeCompare(String(b.label), "en");
    if (labelCompare !== 0) return labelCompare;
    return sortById(a, b);
  });
}

export function buildEntities(dataMap) {
  const refs = {
    locationIds: new Set(dataMap.locations.map((loc) => String(loc.id))),
    personIds: new Set(dataMap.speakers.map((person) => String(person.id))),
    tagIds: new Set(
      dataMap.tagtypes.flatMap((group) =>
        (group.tags || []).map((tag) => String(tag.id)),
      ),
    ),
    contentIds: new Set(dataMap.content.map((item) => String(item.id))),
  };

  const events = dataMap.events.map((event) => buildEventModel(event, refs));
  const tags = buildTags(dataMap.tagtypes);

  return {
    events: buildEntityMap(events),
    content: buildEntityMap(
      dataMap.content.map((item) => {
        const tagIds = uniqAndFilter(item.tag_ids || [], refs.tagIds);
        const peopleEntries = (item.people || [])
          .filter((person) => person?.person_id != null)
          .filter((person) => refs.personIds.has(String(person.person_id)));
        const peopleIds = uniqAndFilter(
          peopleEntries.map((person) => person.person_id),
        );
        const peopleOrderById = new Map(
          peopleEntries.map((person) => [
            String(person.person_id),
            person.sort_order ?? null,
          ]),
        );
        const model = {
          id: item.id,
          title: item.title,
        };
        if (tagIds.length) model.tag_ids = tagIds;
        if (peopleIds.length) {
          model.people = peopleIds.map((personId) => ({
            person_id: personId,
            sort_order: peopleOrderById.get(String(personId)) ?? null,
          }));
        }
        return model;
      }),
    ),
    people: buildEntityMap(
      dataMap.speakers.map((person) => {
        const affiliations = normalizeAffiliations(person.affiliations);
        const model = {
          id: person.id,
          name: person.name,
        };
        if (affiliations.length) model.affiliations = affiliations;
        return model;
      }),
    ),
    locations: buildEntityMap(
      dataMap.locations.map((location) => ({
        id: location.id,
        name: location.name,
        short_name: location.short_name ?? null,
        parent_id: location.parent_id ?? null,
      })),
    ),
    organizations: buildEntityMap(
      dataMap.organizations.map((org) => {
        const logoUrl = org.logo?.url ?? null;
        const model = {
          id: org.id,
          name: org.name,
        };
        if (logoUrl) model.logo_url = logoUrl;
        return model;
      }),
    ),
    tags: buildEntityMap(tags),
    tagTypes: buildEntityMap(
      dataMap.tagtypes.map((tagType) => ({
        id: tagType.id,
        label: tagType.label,
        category: tagType.category ?? null,
        sort_order: tagType.sort_order ?? null,
        is_browsable: Boolean(tagType.is_browsable),
      })),
    ),
    articles: buildEntityMap(
      dataMap.articles.map((article) => ({
        id: article.id,
        name: article.name,
        text: article.text ?? null,
      })),
    ),
    documents: buildEntityMap(
      dataMap.documents.map((doc) => {
        const updatedAtMs = resolveUpdatedAtMs(doc);
        const model = {
          id: doc.id,
          title_text: doc.title_text ?? null,
          body_text: doc.body_text ?? null,
        };
        if (updatedAtMs != null) model.updatedAtMs = updatedAtMs;
        return model;
      }),
    ),
    menus: buildEntityMap(
      dataMap.menus.map((menu) => ({
        id: menu.id,
        title_text: menu.title_text ?? null,
        items: menu.items ?? [],
      })),
    ),
  };
}
