const IMPORT_SETTINGS = {
  bookDefaults: {
    bookType: "solo",
    language: "english",
    ownershipStatus: "none",
    readingStatus: "not_started",
  },
  bookStateStatus: "active",
  canonicalCertainty: "confirmed",
  catalogLocale: "en",
  characterNameMax: 200,
  characterSearchMax: 100,
  directionalityByType: {
    biological_parent_of: "directed",
    half_sibling_of: "symmetric",
    sibling_of: "symmetric",
    spouse_of: "symmetric",
  },
  disputedPaternity: {
    childKeys: ["jacaerys_velaryon", "joffrey_velaryon", "lucerys_velaryon"],
    parentMarkers: ["strong", "velaryon"],
  },
  expectedCounts: { characters: 176, relationships: 335 },
  forbiddenCharacterNames: ["jon snow"],
  houses: {
    groupType: "house",
    membersPerCreate: 100,
    namePrefix: "Дім ",
    notHouses: ["dothraki", "rivers", "unknown", "waters"],
  },
  maxPages: 200,
  mutationDelayMs: 1100,
  pageSize: 100,
  parentType: "biological_parent_of",
  progressEvery: 25,
  relationshipCategory: "family",
  retry: { baseDelayMs: 2000, maxAttempts: 5, statuses: [429, 503] },
};

const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const exactName = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .trim();

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const isKnownHouse = (value) => isNonEmptyString(value) && normalizeText(value) !== "unknown";

const isHouseGroup = (value) =>
  isNonEmptyString(value) && !IMPORT_SETTINGS.houses.notHouses.includes(normalizeText(value));

const withQuery = (path, params) => `${path}?${new globalThis.URLSearchParams(params).toString()}`;

const directionalityOf = (type) =>
  typeof type === "string" && Object.hasOwn(IMPORT_SETTINGS.directionalityByType, type)
    ? IMPORT_SETTINGS.directionalityByType[type]
    : undefined;

const edgeKey = (type, sourceId, targetId) =>
  directionalityOf(type) === "symmetric" && sourceId > targetId
    ? `${type}|${targetId}|${sourceId}`
    : `${type}|${sourceId}|${targetId}`;

const describeEdge = (edge) => ({ from: edge.from, to: edge.to, type: edge.type });

const describeError = (error) => ({
  code: error?.code ?? error?.body?.code ?? null,
  message: error instanceof Error ? error.message : String(error),
  requestId: error?.body?.requestId ?? null,
  status: typeof error?.status === "number" ? error.status : null,
});

export async function runFamilyTreeImport({
  apply = false,
  fixture,
  onProgress = () => {},
  request,
}) {
  if (typeof request !== "function") {
    throw new TypeError("request(method, path, body) must be provided");
  }
  const validated = validateFixture(fixture);
  if (validated.problems.length > 0) {
    return {
      mode: apply === true ? "apply" : "dry-run",
      problems: validated.problems,
      status: "invalid",
    };
  }
  onProgress(
    `fixture valid: ${validated.characters.length} characters, ${validated.relationships.length} relationships`,
  );
  if (apply !== true) {
    return runDryRun({ request, validated });
  }
  return runApply({ onProgress, request, validated });
}

function assertCanonExclusions(fixture, characterByKey, problems) {
  const { childKeys, parentMarkers } = IMPORT_SETTINGS.disputedPaternity;
  for (const edge of fixture.relationships) {
    if (edge?.type !== IMPORT_SETTINGS.parentType || !childKeys.includes(edge.to)) {
      continue;
    }
    const parent = characterByKey.get(edge.from);
    const parentTokens = [
      ...nameTokens(parent?.house),
      ...nameTokens(parent?.name),
      ...nameTokens(edge.from),
    ];
    if (parentTokens.some((token) => parentMarkers.includes(token))) {
      problems.push(`disputed paternity edge must not be imported: ${edge.from} -> ${edge.to}`);
    }
  }

  const excludedPersons = (fixture.metadata?.exclusions ?? [])
    .map((exclusion) => normalizeText(exclusion?.person))
    .filter((person) => person.length > 0);
  for (const character of characterByKey.values()) {
    if (excludedPersons.includes(normalizeText(character.name))) {
      problems.push(`excluded person present as a character: ${character.name}`);
    }
  }

  const connectedPairs = new Set(
    fixture.relationships.flatMap((edge) => [
      `${edge?.from}|${edge?.to}`,
      `${edge?.to}|${edge?.from}`,
    ]),
  );
  for (const note of fixture.not_imported_notes ?? []) {
    const hasPair = isNonEmptyString(note?.from) && isNonEmptyString(note?.to);
    if (hasPair && connectedPairs.has(`${note.from}|${note.to}`)) {
      problems.push(
        `not_imported_notes pair present as a relationship: ${note.from} -> ${note.to}`,
      );
    }
  }
}

function assertParentGraphIsAcyclic(relationships, characterByKey, problems) {
  const parentEdges = relationships.filter(
    (edge) =>
      edge?.type === IMPORT_SETTINGS.parentType &&
      characterByKey.has(edge.from) &&
      characterByKey.has(edge.to),
  );
  const childrenByParent = new Map();
  const inDegree = new Map([...characterByKey.keys()].map((key) => [key, 0]));
  for (const edge of parentEdges) {
    const children = childrenByParent.get(edge.from) ?? [];
    children.push(edge.to);
    childrenByParent.set(edge.from, children);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([key]) => key);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    visited += 1;
    for (const child of childrenByParent.get(current) ?? []) {
      const remaining = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) {
        queue.push(child);
      }
    }
  }
  if (visited !== inDegree.size) {
    const cyclic = [...inDegree.entries()].filter(([, degree]) => degree > 0).map(([key]) => key);
    problems.push(`parent edges contain a cycle through: ${cyclic.join(", ")}`);
  }
}

function buildBookBody({ authorReferences, book, publisherField }) {
  return {
    ...IMPORT_SETTINGS.bookDefaults,
    ...publisherField,
    authors: authorReferences,
    description: isNonEmptyString(book.description_uk) ? book.description_uk.trim() : null,
    isbn: digitsOnly(book.isbn13),
    pagesCount: book.page_count,
    publicationYear: Number(String(book.publication_date).slice(0, 4)),
    title: book.title.trim(),
  };
}

function buildCharacterBody(character) {
  const description = characterDescription(character);
  return {
    bookProfile: description === null ? {} : { description },
    character: { entityKind: "individual", name: character.name.trim() },
    mode: "new",
  };
}

function buildRelationshipBody({ bookId, edge, idByKey }) {
  return {
    category: IMPORT_SETTINGS.relationshipCategory,
    directionality: directionalityOf(edge.type),
    initialBookStates: [
      { bookId, hideRelationshipAsSpoiler: false, status: IMPORT_SETTINGS.bookStateStatus },
    ],
    isCanonical: edge.certainty === IMPORT_SETTINGS.canonicalCertainty,
    sourceCharacterId: idByKey.get(edge.from),
    targetCharacterId: idByKey.get(edge.to),
    type: edge.type,
  };
}

function characterDescription(character) {
  const parts = [
    isKnownHouse(character.house) ? `Дім ${character.house.trim()}` : null,
    isNonEmptyString(character.era) ? character.era.trim() : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function countFixturePresence({ state, validated }) {
  const idByKey = resolveUniqueIds({ characters: validated.characters, roster: state.roster });
  const existingEdges = indexRelationships(state.relationships);
  const presentEdges = validated.relationships.filter((edge) =>
    hasEdge({ edge, existingEdges, idByKey }),
  );
  return {
    characters: { fromFixture: idByKey.size, total: state.roster.length },
    relationships: { fromFixture: presentEdges.length, total: state.relationships.length },
  };
}

async function createBook({ onProgress, request, validated }) {
  const { references } = await resolveAuthorReferences(request, validated.book.authors);
  const { field } = await resolvePublisher(request, validated.book.publisher);
  const body = buildBookBody({
    authorReferences: references,
    book: validated.book,
    publisherField: field,
  });
  const created = await withRetry({
    label: "book",
    onProgress,
    operation: () => request("POST", "/api/books", body),
    recheck: async () => {
      const target = await findTargetBook(request, validated.book);
      return target.mode === "reuse" ? { id: target.id } : null;
    },
  });
  await sleep(IMPORT_SETTINGS.mutationDelayMs);
  return created.id;
}

async function ensureHouses({ bookId, onProgress, request, validated }) {
  const state = await readBookState(request, bookId);
  const idByKey = resolveUniqueIds({ characters: validated.characters, roster: state.roster });
  const summary = { created: 0, membersAdded: 0, reused: 0 };
  for (const house of toFixtureHouses(validated.characters)) {
    const memberIds = house.keys.flatMap((key) => {
      const id = idByKey.get(key);
      return id === undefined ? [] : [id];
    });
    const existing = await findHouseGroup({ name: house.name, request });
    let groupId = existing?.id ?? null;
    let present = new Set();
    if (groupId === null) {
      const initial = memberIds.slice(0, IMPORT_SETTINGS.houses.membersPerCreate);
      const created = await withRetry({
        label: `house ${house.name}`,
        onProgress,
        operation: () =>
          request("POST", "/api/character-groups", {
            members: initial.map((characterId) => ({ bookId, characterId })),
            name: house.name,
            type: IMPORT_SETTINGS.houses.groupType,
          }),
        recheck: () => findHouseGroup({ name: house.name, request }),
      });
      groupId = created.id;
      present = new Set(initial);
      summary.created += 1;
      summary.membersAdded += initial.length;
      await sleep(IMPORT_SETTINGS.mutationDelayMs);
    } else {
      const details = await request("GET", `/api/character-groups/${groupId}`);
      present = new Set(
        (Array.isArray(details?.members) ? details.members : []).map(
          (member) => member.characterId,
        ),
      );
      summary.reused += 1;
    }
    for (const characterId of memberIds.filter((id) => !present.has(id))) {
      await withRetry({
        label: `house ${house.name} member ${characterId}`,
        onProgress,
        operation: () =>
          request("PUT", `/api/character-groups/${groupId}/members/${characterId}`, { bookId }),
        recheck: () => Promise.resolve(null),
      });
      summary.membersAdded += 1;
      await sleep(IMPORT_SETTINGS.mutationDelayMs);
    }
    onProgress(`house ${house.name}: ${memberIds.length} members`);
  }
  return summary;
}

async function findCharacterInBook({ bookId, name, request }) {
  const found = await listAllPages(request, `/api/books/${bookId}/characters`, {
    search: name.trim().slice(0, IMPORT_SETTINGS.characterSearchMax),
  });
  const exact = found.filter((item) => exactName(item?.name) === exactName(name));
  return exact.length === 1 ? { id: exact[0].characterId } : null;
}

async function findHouseGroup({ name, request }) {
  const groups = await listAllPages(request, "/api/character-groups", {
    q: name,
    type: IMPORT_SETTINGS.houses.groupType,
  });
  return groups.find((group) => normalizeText(group?.name) === normalizeText(name)) ?? null;
}

async function findRelationshipInBook({ bookId, edge, idByKey, request }) {
  const state = await request("GET", `/api/books/${bookId}/character-relationships`);
  const keys = indexRelationships(Array.isArray(state) ? state : []);
  const id = keys.get(edgeKey(edge.type, idByKey.get(edge.from), idByKey.get(edge.to)));
  return id === undefined ? null : { id };
}

async function findTargetBook(request, book) {
  const isbn = digitsOnly(book.isbn13);
  const title = normalizeText(book.title);
  const byIsbn = await listAllPages(request, "/api/books", { q: isbn, searchPublisher: "false" });
  const byTitle = await listAllPages(request, "/api/books", {
    q: book.title.trim(),
    searchPublisher: "false",
  });
  const matches = new Map();
  for (const item of [...byIsbn, ...byTitle]) {
    if (digitsOnly(item?.isbn) === isbn || normalizeText(item?.title) === title) {
      matches.set(item.id, item);
    }
  }
  const matchIds = [...matches.keys()];
  if (matchIds.length > 1) {
    return {
      mode: "ambiguous",
      problem: `several library books match the ISBN or title: ${matchIds.join(", ")}`,
    };
  }
  if (matchIds.length === 1) {
    return { id: matchIds[0], mode: "reuse" };
  }
  const trashed = await listAllPages(request, "/api/books/trash", {});
  const trashedMatch = trashed.find((item) => normalizeText(item?.title) === title);
  if (trashedMatch !== undefined) {
    return {
      mode: "trashed",
      problem: `the book is in the trash (${trashedMatch.id}); restore it in the app first`,
    };
  }
  return { id: null, mode: "create" };
}

function hasEdge({ edge, existingEdges, idByKey }) {
  const sourceId = idByKey.get(edge.from);
  const targetId = idByKey.get(edge.to);
  if (sourceId === undefined || targetId === undefined) {
    return false;
  }
  return existingEdges.has(edgeKey(edge.type, sourceId, targetId));
}

function indexRelationships(relationships) {
  const keys = new Map();
  for (const entry of relationships) {
    const relationship = entry?.relationship;
    if (directionalityOf(relationship?.type) === undefined) {
      continue;
    }
    keys.set(
      edgeKey(relationship.type, relationship.sourceCharacterId, relationship.targetCharacterId),
      relationship.id,
    );
  }
  return keys;
}

function indexRoster(roster) {
  const idsByName = new Map();
  for (const item of roster) {
    const name = exactName(item?.name);
    const ids = idsByName.get(name) ?? [];
    if (!ids.includes(item.characterId)) {
      ids.push(item.characterId);
    }
    idsByName.set(name, ids);
  }
  return idsByName;
}

async function listAllPages(request, path, params) {
  const items = [];
  for (let pageNumber = 1; pageNumber <= IMPORT_SETTINGS.maxPages; pageNumber += 1) {
    const page = await request(
      "GET",
      withQuery(path, {
        ...params,
        pageNumber: String(pageNumber),
        pageSize: String(IMPORT_SETTINGS.pageSize),
      }),
    );
    const pageItems = Array.isArray(page?.items) ? page.items : [];
    items.push(...pageItems);
    const pagesCount = Number.isInteger(page?.pagesCount) ? page.pagesCount : 0;
    if (pageItems.length === 0 || pageNumber >= pagesCount) {
      return items;
    }
  }
  throw new Error(`pagination did not finish for ${path}`);
}

function nameTokens(value) {
  return normalizeText(value)
    .split(/[^\p{L}]+/u)
    .filter((token) => token.length > 0);
}

async function planImport({ request, validated }) {
  const target = await findTargetBook(request, validated.book);
  if (target.mode === "ambiguous" || target.mode === "trashed") {
    return { problems: [target.problem], target };
  }
  const state =
    target.mode === "reuse"
      ? await readBookState(request, target.id)
      : { relationships: [], roster: [] };
  const plan = reconcile({ state, validated });
  return { plan, problems: plan.problems, target };
}

async function readBookState(request, bookId) {
  const roster = await listAllPages(request, `/api/books/${bookId}/characters`, { sort: "name" });
  const relationships = await request("GET", `/api/books/${bookId}/character-relationships`);
  return { relationships: Array.isArray(relationships) ? relationships : [], roster };
}

function reconcile({ state, validated }) {
  const problems = [];
  const idByKey = new Map();
  const charactersToCreate = [];
  const idsByName = indexRoster(state.roster);
  for (const character of validated.characters) {
    const ids = idsByName.get(exactName(character.name)) ?? [];
    if (ids.length > 1) {
      problems.push(`several characters named "${character.name}" already exist in the book`);
      continue;
    }
    if (ids.length === 1) {
      idByKey.set(character.key, ids[0]);
      continue;
    }
    charactersToCreate.push(character);
  }

  const existingEdges = indexRelationships(state.relationships);
  const relationshipsToCreate = validated.relationships.filter(
    (edge) => !hasEdge({ edge, existingEdges, idByKey }),
  );

  return {
    charactersSkipped: validated.characters.length - charactersToCreate.length,
    charactersToCreate,
    idByKey,
    problems,
    relationshipsSkipped: validated.relationships.length - relationshipsToCreate.length,
    relationshipsToCreate,
  };
}

function remainingAfter({ createdCharacterKeys, createdEdgeKeys, plan }) {
  return {
    characters: plan.charactersToCreate
      .map((character) => character.key)
      .filter((key) => !createdCharacterKeys.has(key)),
    relationships: plan.relationshipsToCreate
      .filter((edge) => !createdEdgeKeys.has(edgeKey(edge.type, edge.from, edge.to)))
      .map(describeEdge),
  };
}

async function resolveAuthorReferences(request, authorNames) {
  const references = [];
  const resolution = [];
  for (const name of authorNames) {
    const found = await listAllPages(request, "/api/authors", {
      locale: IMPORT_SETTINGS.catalogLocale,
      search: name.trim(),
    });
    const exact = found.filter((author) => normalizeText(author?.name) === normalizeText(name));
    if (exact.length === 1) {
      references.push({ id: exact[0].id });
      resolution.push({ id: exact[0].id, name, resolution: "existing" });
      continue;
    }
    references.push({ name: name.trim() });
    resolution.push({ name, resolution: "resolve-or-create-by-name" });
  }
  return { references, resolution };
}

async function resolvePublisher(request, publisherName) {
  if (!isNonEmptyString(publisherName)) {
    return { field: {}, resolution: { resolution: "none" } };
  }
  const found = await listAllPages(request, "/api/publishers", {
    locale: IMPORT_SETTINGS.catalogLocale,
    search: publisherName.trim(),
  });
  const exact = found.filter(
    (publisher) => normalizeText(publisher?.name) === normalizeText(publisherName),
  );
  if (exact.length === 1) {
    return {
      field: { publisherId: exact[0].id },
      resolution: { id: exact[0].id, name: publisherName, resolution: "existing" },
    };
  }
  return {
    field: { publisherName: publisherName.trim() },
    resolution: { name: publisherName, resolution: "resolve-or-create-by-name" },
  };
}

function resolveUniqueIds({ characters, roster }) {
  const idsByName = indexRoster(roster);
  const idByKey = new Map();
  for (const character of characters) {
    const ids = idsByName.get(exactName(character.name)) ?? [];
    if (ids.length === 1) {
      idByKey.set(character.key, ids[0]);
    }
  }
  return idByKey;
}

async function runApply({ onProgress, request, validated }) {
  const { plan: initialPlan, problems, target } = await planImport({ request, validated });
  if (problems.length > 0) {
    return {
      mode: "apply",
      problems,
      status: "blocked",
      validation: validationSummary(validated),
    };
  }
  const planSummary = summarizePlan({ bookMode: target.mode, plan: initialPlan });
  const createdCharacterKeys = new Set();
  const createdEdgeKeys = new Set();
  let bookId = target.id;
  let plan = initialPlan;

  try {
    if (target.mode === "create") {
      onProgress("creating the book");
      bookId = await createBook({ onProgress, request, validated });
      onProgress(`book created: ${bookId}`);
      plan = reconcile({ state: await readBookState(request, bookId), validated });
    } else {
      onProgress(`reusing book ${bookId}`);
    }

    const idByKey = new Map(plan.idByKey);
    const characterTotal = plan.charactersToCreate.length;
    for (const [index, character] of plan.charactersToCreate.entries()) {
      const created = await withRetry({
        label: `character ${character.key}`,
        onProgress,
        operation: () =>
          request("POST", `/api/books/${bookId}/characters`, buildCharacterBody(character)),
        recheck: () => findCharacterInBook({ bookId, name: character.name, request }),
      });
      idByKey.set(character.key, created.id);
      createdCharacterKeys.add(character.key);
      onProgress(`character ${index + 1}/${characterTotal}: ${character.name}`);
      await sleep(IMPORT_SETTINGS.mutationDelayMs);
    }

    const edgeTotal = plan.relationshipsToCreate.length;
    for (const [index, edge] of plan.relationshipsToCreate.entries()) {
      const sourceId = idByKey.get(edge.from);
      const targetId = idByKey.get(edge.to);
      if (sourceId === undefined || targetId === undefined || sourceId === targetId) {
        throw new Error(
          `cannot resolve distinct endpoints for ${edge.type} ${edge.from} -> ${edge.to}`,
        );
      }
      await withRetry({
        label: `relationship ${edge.type} ${edge.from} -> ${edge.to}`,
        onProgress,
        operation: () =>
          request(
            "POST",
            "/api/character-relationships",
            buildRelationshipBody({ bookId, edge, idByKey }),
          ),
        recheck: () => findRelationshipInBook({ bookId, edge, idByKey, request }),
      });
      createdEdgeKeys.add(edgeKey(edge.type, edge.from, edge.to));
      if ((index + 1) % IMPORT_SETTINGS.progressEvery === 0 || index + 1 === edgeTotal) {
        onProgress(`relationships ${index + 1}/${edgeTotal}`);
      }
      await sleep(IMPORT_SETTINGS.mutationDelayMs);
    }
  } catch (error) {
    return {
      bookId,
      created: {
        book: target.mode === "create" && bookId !== null,
        characters: [...createdCharacterKeys],
        relationships: plan.relationshipsToCreate
          .filter((edge) => createdEdgeKeys.has(edgeKey(edge.type, edge.from, edge.to)))
          .map(describeEdge),
      },
      error: describeError(error),
      mode: "apply",
      plan: planSummary,
      remaining: remainingAfter({ createdCharacterKeys, createdEdgeKeys, plan }),
      status: "stopped",
    };
  }

  let houses;
  try {
    houses = await ensureHouses({ bookId, onProgress, request, validated });
  } catch (error) {
    return {
      bookId,
      created: { characters: createdCharacterKeys.size, relationships: createdEdgeKeys.size },
      error: describeError(error),
      mode: "apply",
      plan: planSummary,
      stage: "houses",
      status: "stopped",
    };
  }

  onProgress("re-reading the book to verify");
  let actual;
  try {
    actual = countFixturePresence({ state: await readBookState(request, bookId), validated });
  } catch (error) {
    return {
      bookId,
      created: { characters: createdCharacterKeys.size, relationships: createdEdgeKeys.size },
      error: describeError(error),
      mode: "apply",
      plan: planSummary,
      status: "unverified",
    };
  }
  const isComplete =
    actual.characters.fromFixture === validated.characters.length &&
    actual.relationships.fromFixture === validated.relationships.length;
  return {
    actual,
    bookId,
    created: { characters: createdCharacterKeys.size, relationships: createdEdgeKeys.size },
    houses,
    mode: "apply",
    plan: planSummary,
    status: isComplete ? "completed" : "incomplete",
  };
}

async function runDryRun({ request, validated }) {
  const { plan, problems, target } = await planImport({ request, validated });
  if (problems.length > 0) {
    return {
      mode: "dry-run",
      problems,
      status: "blocked",
      validation: validationSummary(validated),
    };
  }
  const isNewBook = target.mode === "create";
  const authors = isNewBook
    ? (await resolveAuthorReferences(request, validated.book.authors)).resolution
    : null;
  const publisher = isNewBook
    ? (await resolvePublisher(request, validated.book.publisher)).resolution
    : null;
  const houses = toFixtureHouses(validated.characters);
  const existingHouses = await Promise.all(
    houses.map((house) => findHouseGroup({ name: house.name, request })),
  );
  return {
    bookId: target.id,
    houses: {
      create: existingHouses.filter((group) => group === null).length,
      planned: houses.length,
      reuse: existingHouses.filter((group) => group !== null).length,
    },
    mode: "dry-run",
    plan: summarizePlan({ bookMode: target.mode, plan }),
    resolution: { authors, publisher },
    status: "ok",
    validation: validationSummary(validated),
  };
}

function summarizePlan({ bookMode, plan }) {
  return {
    book: bookMode,
    characters: { create: plan.charactersToCreate.length, skip: plan.charactersSkipped },
    relationships: { create: plan.relationshipsToCreate.length, skip: plan.relationshipsSkipped },
  };
}

function toFixtureHouses(characters) {
  const keysByHouse = new Map();
  for (const character of characters) {
    if (!isHouseGroup(character.house)) {
      continue;
    }
    const house = exactName(character.house);
    keysByHouse.set(house, [...(keysByHouse.get(house) ?? []), character.key]);
  }
  return [...keysByHouse]
    .map(([house, keys]) => ({ keys, name: `${IMPORT_SETTINGS.houses.namePrefix}${house}` }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function validateBookMetadata(book, problems) {
  if (book === null || typeof book !== "object") {
    problems.push("metadata.book is missing");
    return;
  }
  if (!isNonEmptyString(book.title)) {
    problems.push("metadata.book.title is missing");
  }
  const authors = Array.isArray(book.authors) ? book.authors : [];
  if (authors.length === 0 || !authors.every(isNonEmptyString)) {
    problems.push("metadata.book.authors must be a non-empty list of names");
  }
  if (digitsOnly(book.isbn13).length !== 13) {
    problems.push("metadata.book.isbn13 must have 13 digits");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(book.publication_date ?? ""))) {
    problems.push("metadata.book.publication_date must be YYYY-MM-DD");
  }
  if (!Number.isInteger(book.page_count) || book.page_count <= 0) {
    problems.push("metadata.book.page_count must be a positive integer");
  }
}

function validateCharacters(characters, problems) {
  const characterByKey = new Map();
  const seenNames = new Set();
  for (const character of characters) {
    if (!isNonEmptyString(character?.key) || !isNonEmptyString(character?.name)) {
      problems.push(`character without key or name: ${JSON.stringify(character)}`);
      continue;
    }
    if (character.name.trim().length > IMPORT_SETTINGS.characterNameMax) {
      problems.push(`character name too long: ${character.key}`);
    }
    if (characterByKey.has(character.key)) {
      problems.push(`duplicate character key: ${character.key}`);
    }
    const normalizedName = normalizeText(character.name);
    if (seenNames.has(normalizedName)) {
      problems.push(`duplicate character name: ${character.name}`);
    }
    const isForbidden = IMPORT_SETTINGS.forbiddenCharacterNames.some(
      (forbidden) => normalizedName === forbidden || normalizedName.startsWith(`${forbidden} `),
    );
    if (isForbidden) {
      problems.push(`forbidden character present: ${character.name}`);
    }
    seenNames.add(normalizedName);
    characterByKey.set(character.key, character);
  }
  return characterByKey;
}

function validateFixture(fixture) {
  const problems = [];
  if (fixture === null || typeof fixture !== "object") {
    return { problems: ["fixture is not an object"] };
  }
  validateBookMetadata(fixture.metadata?.book, problems);
  const characters = Array.isArray(fixture.characters) ? fixture.characters : [];
  const relationships = Array.isArray(fixture.relationships) ? fixture.relationships : [];
  const { expectedCounts } = IMPORT_SETTINGS;
  if (characters.length !== expectedCounts.characters) {
    problems.push(`expected ${expectedCounts.characters} characters, got ${characters.length}`);
  }
  if (relationships.length !== expectedCounts.relationships) {
    problems.push(
      `expected ${expectedCounts.relationships} relationships, got ${relationships.length}`,
    );
  }
  const characterByKey = validateCharacters(characters, problems);
  validateRelationships(relationships, characterByKey, problems);
  assertParentGraphIsAcyclic(relationships, characterByKey, problems);
  assertCanonExclusions({ ...fixture, relationships }, characterByKey, problems);
  return {
    book: fixture.metadata?.book,
    characterByKey,
    characters,
    problems,
    relationships,
  };
}

function validateRelationships(relationships, characterByKey, problems) {
  const seenEdges = new Set();
  for (const edge of relationships) {
    const label = `${edge?.type} ${edge?.from} -> ${edge?.to}`;
    if (directionalityOf(edge?.type) === undefined) {
      problems.push(`unsupported relationship type: ${label}`);
      continue;
    }
    if (!characterByKey.has(edge.from) || !characterByKey.has(edge.to)) {
      problems.push(`relationship endpoint not found: ${label}`);
      continue;
    }
    if (edge.from === edge.to) {
      problems.push(`self relationship: ${label}`);
      continue;
    }
    const key = edgeKey(edge.type, edge.from, edge.to);
    if (seenEdges.has(key)) {
      problems.push(`duplicate relationship: ${label}`);
    }
    seenEdges.add(key);
  }
}

function validationSummary(validated) {
  return {
    characters: validated.characters.length,
    parentEdges: validated.relationships.filter((edge) => edge.type === IMPORT_SETTINGS.parentType)
      .length,
    relationships: validated.relationships.length,
  };
}

async function withRetry({ label, onProgress, operation, recheck }) {
  const { baseDelayMs, maxAttempts, statuses } = IMPORT_SETTINGS.retry;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!statuses.includes(error?.status) || attempt >= maxAttempts) {
        throw error;
      }
      const waitMs = baseDelayMs * 2 ** (attempt - 1);
      onProgress(
        `${label}: HTTP ${error.status}, retry ${attempt}/${maxAttempts - 1} in ${waitMs} ms`,
      );
      await sleep(waitMs);
      const alreadyCreated = await recheck();
      if (alreadyCreated !== null) {
        onProgress(`${label}: found on the server after HTTP ${error.status}, not resending`);
        return alreadyCreated;
      }
    }
  }
}
