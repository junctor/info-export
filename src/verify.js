function compareStringsCaseInsensitive(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

function sortTagsWithRefs(a, b, tagsById) {
  const aTag = tagsById[String(a.id)];
  const bTag = tagsById[String(b.id)];
  const aOrder = aTag?.sort_order ?? 0;
  const bOrder = bTag?.sort_order ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const labelCompare = String(a.label).localeCompare(String(b.label), "en");
  if (labelCompare !== 0) return labelCompare;
  return String(a.id).localeCompare(String(b.id), "en");
}

function isSorted(list, compare) {
  for (let i = 1; i < list.length; i += 1) {
    if (compare(list[i - 1], list[i]) > 0) return false;
  }
  return true;
}

function keysAreSubset(obj, allowedKeys) {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) return false;
  }
  return true;
}

function eventStartSeconds(event) {
  return event?.beginTimestampSeconds ?? 0;
}

function checkEntityStore(name, store, errors) {
  if (!store || !Array.isArray(store.allIds) || !store.byId) {
    errors.push(`entities/${name} missing allIds/byId`);
    return;
  }
  const allIds = store.allIds;
  if (!isSorted(allIds, (a, b) => String(a).localeCompare(String(b), "en"))) {
    errors.push(`entities/${name}.allIds not sorted`);
  }
  const seen = new Set();
  for (const id of allIds) {
    const key = String(id);
    if (seen.has(key)) {
      errors.push(`entities/${name}.allIds contains duplicate ${key}`);
      break;
    }
    seen.add(key);
    const entry = store.byId[key];
    if (!entry) {
      errors.push(`entities/${name}.byId missing ${key}`);
      break;
    }
    if (entry.id == null || String(entry.id) !== key) {
      errors.push(`entities/${name}.byId id mismatch for ${key}`);
      break;
    }
  }
  const byIdKeys = Object.keys(store.byId || {});
  if (byIdKeys.length !== allIds.length) {
    errors.push(`entities/${name} byId/allIds length mismatch`);
  }
}

function checkIndexSorted(indexName, index, eventsById, contentById, errors) {
  const compareEventIds = (a, b) => {
    const aEvent = eventsById[String(a)];
    const bEvent = eventsById[String(b)];
    const aStart = eventStartSeconds(aEvent);
    const bStart = eventStartSeconds(bEvent);
    if (aStart !== bStart) return aStart - bStart;
    return String(a).localeCompare(String(b), "en");
  };

  const compareContentIds = (a, b) => {
    const aTitle = contentById[String(a)]?.title ?? "";
    const bTitle = contentById[String(b)]?.title ?? "";
    const titleCompare = compareStringsCaseInsensitive(aTitle, bTitle);
    if (titleCompare !== 0) return titleCompare;
    return String(a).localeCompare(String(b), "en");
  };

  for (const [key, list] of Object.entries(index || {})) {
    if (!Array.isArray(list)) {
      errors.push(`indexes/${indexName}.${key} is not an array`);
      continue;
    }
    const compare =
      indexName === "contentByTag" ? compareContentIds : compareEventIds;
    if (!isSorted(list, compare)) {
      errors.push(`indexes/${indexName}.${key} not sorted`);
      break;
    }
  }
}

function checkViewArrays(views, entities, errors) {
  const organizationsCards = views.organizationsCards ?? null;
  const peopleCards = views.peopleCards ?? [];
  const tagTypesBrowse = views.tagTypesBrowse ?? [];
  const documentsList = views.documentsList ?? [];
  const contentCards = views.contentCards ?? [];
  const eventCardsById = views.eventCardsById ?? null;

  if (
    eventCardsById &&
    Object.prototype.hasOwnProperty.call(eventCardsById, "allIds")
  ) {
    errors.push(
      "views/eventCardsById contains allIds (should be byId map only)",
    );
  }
  if (
    !eventCardsById ||
    typeof eventCardsById !== "object" ||
    Array.isArray(eventCardsById)
  ) {
    errors.push("views/eventCardsById is not a map");
  } else {
    const allowedEventKeys = new Set([
      "id",
      "content_id",
      "begin",
      "end",
      "title",
      "color",
      "location",
      "speakers",
      "tags",
    ]);
    const requiredEventKeys = [
      "id",
      "content_id",
      "begin",
      "end",
      "title",
      "color",
      "location",
      "speakers",
      "tags",
    ];
    const allowedTagKeys = new Set([
      "id",
      "label",
      "color_background",
      "color_foreground",
    ]);
    for (const [id, card] of Object.entries(eventCardsById)) {
      if (!card || card.id == null || String(card.id) !== String(id)) {
        errors.push(`views/eventCardsById missing id for ${id}`);
        break;
      }
      if (!("title" in card) || !("begin" in card) || !("end" in card)) {
        errors.push(`views/eventCardsById missing required keys for ${id}`);
        break;
      }
      for (const key of requiredEventKeys) {
        if (!(key in card)) {
          errors.push(`views/eventCardsById missing ${key} for ${id}`);
          break;
        }
      }
      if (!keysAreSubset(card, allowedEventKeys)) {
        errors.push(`views/eventCardsById has extra keys for ${id}`);
        break;
      }
      if (!Array.isArray(card.tags)) {
        errors.push(`views/eventCardsById.tags not array for ${id}`);
        break;
      }
      if (
        !isSorted(card.tags, (a, b) =>
          sortTagsWithRefs(a, b, entities.tags.byId),
        )
      ) {
        errors.push(`views/eventCardsById.tags not sorted for ${id}`);
        break;
      }
      for (const tag of card.tags) {
        if (tag?.id == null || !tag?.label) {
          errors.push(`views/eventCardsById.tags missing id/label for ${id}`);
          break;
        }
        if (!keysAreSubset(tag, allowedTagKeys)) {
          errors.push(`views/eventCardsById.tags has extra keys for ${id}`);
          break;
        }
      }
    }
  }

  if (
    !organizationsCards ||
    typeof organizationsCards !== "object" ||
    Array.isArray(organizationsCards)
  ) {
    errors.push("views/organizationsCards not map");
  } else {
    const allowedOrgKeys = new Set(["id", "name", "logoUrl"]);
    for (const [tagKey, list] of Object.entries(organizationsCards)) {
      if (!Array.isArray(list)) {
        errors.push(`views/organizationsCards.${tagKey} not array`);
        break;
      }
      if (
        !isSorted(list, (a, b) => {
          const nameCompare = compareStringsCaseInsensitive(a.name, b.name);
          if (nameCompare !== 0) return nameCompare;
          return String(a.id).localeCompare(String(b.id), "en");
        })
      ) {
        errors.push(`views/organizationsCards.${tagKey} not sorted`);
        break;
      }
      const seenIds = new Set();
      for (const org of list) {
        if (org?.id == null || org?.name == null) {
          errors.push("views/organizationsCards missing id/name");
          break;
        }
        const key = String(org.id);
        if (seenIds.has(key)) {
          errors.push("views/organizationsCards has duplicate id in group");
          break;
        }
        seenIds.add(key);
        if (!keysAreSubset(org, allowedOrgKeys)) {
          errors.push("views/organizationsCards has extra keys");
          break;
        }
      }
      if (errors.length) break;
    }
  }

  if (!Array.isArray(peopleCards)) {
    errors.push("views/peopleCards not array");
  } else if (
    !isSorted(peopleCards, (a, b) => {
      const nameCompare = compareStringsCaseInsensitive(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;
      return String(a.id).localeCompare(String(b.id), "en");
    })
  ) {
    errors.push("views/peopleCards not sorted");
  } else {
    const allowedPeopleKeys = new Set(["id", "name", "affiliations"]);
    for (const person of peopleCards) {
      if (person?.id == null || person?.name == null) {
        errors.push("views/peopleCards missing id/name");
        break;
      }
      if (!("affiliations" in person)) {
        errors.push("views/peopleCards missing affiliations");
        break;
      }
      if (!keysAreSubset(person, allowedPeopleKeys)) {
        errors.push("views/peopleCards has extra keys");
        break;
      }
    }
  }

  if (!Array.isArray(tagTypesBrowse)) {
    errors.push("views/tagTypesBrowse not array");
  } else {
    for (const type of tagTypesBrowse) {
      if (!Array.isArray(type.tags)) {
        errors.push("views/tagTypesBrowse.tags not array");
        break;
      }
      if (
        !isSorted(type.tags, (a, b) =>
          sortTagsWithRefs(a, b, entities.tags.byId),
        )
      ) {
        errors.push("views/tagTypesBrowse.tags not sorted");
        break;
      }
    }
    if (
      !isSorted(tagTypesBrowse, (a, b) => {
        const aOrder = a.sort_order ?? 0;
        const bOrder = b.sort_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        const labelCompare = String(a.label).localeCompare(
          String(b.label),
          "en",
        );
        if (labelCompare !== 0) return labelCompare;
        return String(a.id).localeCompare(String(b.id), "en");
      })
    ) {
      errors.push("views/tagTypesBrowse not sorted");
    }
    const allowedTypeKeys = new Set([
      "id",
      "label",
      "category",
      "sort_order",
      "tags",
    ]);
    const allowedTagKeys = new Set([
      "id",
      "label",
      "color_background",
      "color_foreground",
      "sort_order",
    ]);
    for (const type of tagTypesBrowse) {
      if (type?.id == null || type?.label == null) {
        errors.push("views/tagTypesBrowse missing id/label");
        break;
      }
      if (!("tags" in type)) {
        errors.push("views/tagTypesBrowse missing tags");
        break;
      }
      if (!keysAreSubset(type, allowedTypeKeys)) {
        errors.push("views/tagTypesBrowse has extra keys");
        break;
      }
      for (const tag of type.tags || []) {
        if (tag?.id == null || tag?.label == null) {
          errors.push("views/tagTypesBrowse.tags missing id/label");
          break;
        }
        if (!keysAreSubset(tag, allowedTagKeys)) {
          errors.push("views/tagTypesBrowse.tags has extra keys");
          break;
        }
      }
    }
  }

  if (!Array.isArray(documentsList)) {
    errors.push("views/documentsList not array");
  } else if (
    !isSorted(documentsList, (a, b) => {
      if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
      return String(a.id).localeCompare(String(b.id), "en");
    })
  ) {
    errors.push("views/documentsList not sorted");
  } else {
    const allowedDocKeys = new Set(["id", "title_text", "updatedAtMs"]);
    for (const doc of documentsList) {
      if (doc?.id == null) {
        errors.push("views/documentsList missing id");
        break;
      }
      if (!("title_text" in doc) || !("updatedAtMs" in doc)) {
        errors.push("views/documentsList missing required keys");
        break;
      }
      if (!keysAreSubset(doc, allowedDocKeys)) {
        errors.push("views/documentsList has extra keys");
        break;
      }
    }
  }

  if (!Array.isArray(contentCards)) {
    errors.push("views/contentCards not array");
  } else {
    for (const card of contentCards) {
      if (!Array.isArray(card.tags)) {
        errors.push("views/contentCards.tags not array");
        break;
      }
      if (
        !isSorted(card.tags, (a, b) =>
          sortTagsWithRefs(a, b, entities.tags.byId),
        )
      ) {
        errors.push("views/contentCards.tags not sorted");
        break;
      }
    }
    if (
      !isSorted(contentCards, (a, b) => {
        const titleCompare = compareStringsCaseInsensitive(a.title, b.title);
        if (titleCompare !== 0) return titleCompare;
        return String(a.id).localeCompare(String(b.id), "en");
      })
    ) {
      errors.push("views/contentCards not sorted");
    }
    const allowedContentKeys = new Set(["id", "title", "tags"]);
    const allowedTagKeys = new Set([
      "id",
      "label",
      "color_background",
      "color_foreground",
    ]);
    for (const card of contentCards) {
      if (card?.id == null || card?.title == null) {
        errors.push("views/contentCards missing id/title");
        break;
      }
      if (!("tags" in card)) {
        errors.push("views/contentCards missing tags");
        break;
      }
      if (!keysAreSubset(card, allowedContentKeys)) {
        errors.push("views/contentCards has extra keys");
        break;
      }
      for (const tag of card.tags || []) {
        if (tag?.id == null || tag?.label == null) {
          errors.push("views/contentCards.tags missing id/label");
          break;
        }
        if (!keysAreSubset(tag, allowedTagKeys)) {
          errors.push("views/contentCards.tags has extra keys");
          break;
        }
      }
    }
  }
}

function checkReferenceIntegrity(entities, errors) {
  const locationIds = new Set(Object.keys(entities.locations.byId || {}));
  const personIds = new Set(Object.keys(entities.people.byId || {}));
  const tagIds = new Set(Object.keys(entities.tags.byId || {}));
  const contentIds = new Set(Object.keys(entities.content.byId || {}));

  for (const event of Object.values(entities.events.byId || {})) {
    if (
      event.location_id != null &&
      !locationIds.has(String(event.location_id))
    ) {
      errors.push(`events references missing location ${event.location_id}`);
      break;
    }
    if (event.content_id != null && !contentIds.has(String(event.content_id))) {
      errors.push(`events references missing content ${event.content_id}`);
      break;
    }
    for (const tagId of event.tag_ids || []) {
      if (!tagIds.has(String(tagId))) {
        errors.push(`events references missing tag ${tagId}`);
        return;
      }
    }
    for (const personId of event.speakerIds || []) {
      if (!personIds.has(String(personId))) {
        errors.push(`events references missing speaker ${personId}`);
        return;
      }
    }
    for (const personId of event.personIds || []) {
      if (!personIds.has(String(personId))) {
        errors.push(`events references missing person ${personId}`);
        return;
      }
    }
  }

  for (const item of Object.values(entities.content.byId || {})) {
    for (const tagId of item.tag_ids || []) {
      if (!tagIds.has(String(tagId))) {
        errors.push(`content references missing tag ${tagId}`);
        return;
      }
    }
    for (const person of item.people || []) {
      if (!personIds.has(String(person.person_id))) {
        errors.push(`content references missing person ${person.person_id}`);
        return;
      }
    }
  }
}

export function verifyOutputs({ entities, indexes, views }) {
  const errors = [];

  for (const [name, store] of Object.entries(entities)) {
    checkEntityStore(name, store, errors);
  }

  checkReferenceIntegrity(entities, errors);

  for (const [indexName, index] of Object.entries(indexes)) {
    checkIndexSorted(
      indexName,
      index,
      entities.events.byId,
      entities.content.byId,
      errors,
    );
  }

  checkViewArrays(views, entities, errors);

  return { errors };
}
