import type {
  BookCharacterRosterItem,
  CharacterGlobalSummaryView,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterGraphView,
  CharacterRelationshipBookStateView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipListItemView,
  CharacterRelationshipSafeDetailsView,
  PaginatedCharacterRelationshipListView,
  SafeBookStateView,
  SafeParticipantView,
  SafeRelationshipEdgeView,
} from "@app/shared";

type CharacterIdentity = Pick<SafeParticipantView, "id" | "name">;

type CharacterPage<Item> = Omit<PaginatedCharacterRelationshipListView, "items"> & {
  items: Item[];
};

type RelationshipPageMeta = Partial<
  Pick<PaginatedCharacterRelationshipListView, "page" | "pagesCount" | "totalCount">
>;

export const RELATIONSHIP_FIXTURE = {
  book: { id: "8f2d5c3a-1b4e-4c6d-9a7b-2e3f4a5b6c7d", title: "Останнє бажання" },
  ciri: { id: "c1c1c1c1-0000-4000-8000-000000000001", name: "Цірі" },
  description: "Ґеральт обіцяє забрати дитину, про яку ще не знає.",
  geralt: { id: "9e9e9e9e-0000-4000-8000-000000000002", name: "Ґеральт" },
  relationshipId: "rel-1",
  secondBook: { id: "7b7b7b7b-0000-4000-8000-000000000004", title: "Меч призначення" },
  timestamp: "2026-01-05T10:00:00.000Z",
  yennefer: { id: "e1e1e1e1-0000-4000-8000-000000000003", name: "Єнніфер" },
} as const;

export function makeCharacterPage<Item>(items: Item[]): CharacterPage<Item> {
  return {
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

export function makeEditableBookState(
  overrides: Partial<CharacterRelationshipBookStateView> = {},
): CharacterRelationshipBookStateView {
  return {
    bookId: RELATIONSHIP_FIXTURE.book.id,
    createdAt: RELATIONSHIP_FIXTURE.timestamp,
    description: RELATIONSHIP_FIXTURE.description,
    descriptionHidden: false,
    endedAudioSeconds: null,
    endedChapter: null,
    endedPage: null,
    hideRelationshipAsSpoiler: false,
    id: "state-1",
    intensity: "medium",
    introducedAudioSeconds: null,
    introducedChapter: null,
    introducedPage: null,
    isDescriptionSpoiler: false,
    isTypeSpoiler: false,
    relationshipId: RELATIONSHIP_FIXTURE.relationshipId,
    status: "active",
    updatedAt: RELATIONSHIP_FIXTURE.timestamp,
    ...overrides,
  };
}

export function makeEditableRelationship(
  overrides: Partial<CharacterRelationshipDetailsView> = {},
): CharacterRelationshipDetailsView {
  return {
    bookStates: [makeEditableBookState()],
    category: "family",
    createdAt: RELATIONSHIP_FIXTURE.timestamp,
    customType: null,
    diagnostics: [],
    directionality: "directed",
    id: RELATIONSHIP_FIXTURE.relationshipId,
    isCanonical: false,
    sourceCharacterId: RELATIONSHIP_FIXTURE.geralt.id,
    sourceCharacterName: RELATIONSHIP_FIXTURE.geralt.name,
    sourceLabel: null,
    targetCharacterId: RELATIONSHIP_FIXTURE.ciri.id,
    targetCharacterName: RELATIONSHIP_FIXTURE.ciri.name,
    targetLabel: null,
    type: "guardian_of",
    typeHidden: false,
    updatedAt: RELATIONSHIP_FIXTURE.timestamp,
    ...overrides,
  };
}

export function makeGlobalCharacter({ id, name }: CharacterIdentity): CharacterGlobalSummaryView {
  return {
    appearanceCount: 1,
    archivedAt: null,
    avatar: null,
    customGender: null,
    entityKind: "individual",
    gender: "unknown",
    globalAttitude: null,
    id,
    isFavorite: false,
    name,
    neutralDescription: null,
    pronouns: null,
    species: null,
    tags: [],
  };
}

export function makeMaskedRelationshipEdge(
  overrides: Partial<SafeRelationshipEdgeView> = {},
): SafeRelationshipEdgeView {
  return makeRelationshipEdge({
    category: null,
    customType: null,
    directionality: null,
    isCanonical: null,
    sourceLabel: null,
    targetLabel: null,
    type: null,
    typeHidden: true,
    ...overrides,
  });
}

export function makeNumberedRelationshipItem(number: number): CharacterRelationshipListItemView {
  return makeRelationshipListItem({
    relationship: makeRelationshipEdge({
      id: `rel-${number}`,
      target: makeRelationshipParticipant({
        id: `character-${number}`,
        name: `Персонаж ${number}`,
      }),
    }),
  });
}

export function makeRelationshipBookState(
  overrides: Partial<SafeBookStateView> = {},
): SafeBookStateView {
  return {
    bookId: RELATIONSHIP_FIXTURE.book.id,
    bookTitle: RELATIONSHIP_FIXTURE.book.title,
    description: RELATIONSHIP_FIXTURE.description,
    descriptionHidden: false,
    endedAudioSeconds: null,
    endedChapter: null,
    endedPage: null,
    id: "state-1",
    intensity: "medium",
    introducedAudioSeconds: null,
    introducedChapter: null,
    introducedPage: null,
    partNumber: 1,
    status: "active",
    ...overrides,
  };
}

export function makeRelationshipDetails(
  overrides: Partial<CharacterRelationshipSafeDetailsView> = {},
): CharacterRelationshipSafeDetailsView {
  return {
    effectiveState: makeRelationshipBookState(),
    history: [makeRelationshipBookState()],
    relationship: makeRelationshipEdge(),
    ...overrides,
  };
}

export function makeRelationshipEdge(
  overrides: Partial<SafeRelationshipEdgeView> = {},
): SafeRelationshipEdgeView {
  return {
    category: "family",
    createdAt: RELATIONSHIP_FIXTURE.timestamp,
    customType: null,
    directionality: "directed",
    id: RELATIONSHIP_FIXTURE.relationshipId,
    isCanonical: true,
    source: makeRelationshipParticipant(),
    sourceLabel: null,
    target: makeRelationshipParticipant(RELATIONSHIP_FIXTURE.ciri),
    targetLabel: null,
    type: "guardian_of",
    typeHidden: false,
    visibleChangedAt: RELATIONSHIP_FIXTURE.timestamp,
    ...overrides,
  };
}

export function makeRelationshipGraph(
  overrides: Partial<CharacterGraphView> = {},
): CharacterGraphView {
  return {
    clusterBy: null,
    clusters: [],
    diagnostics: [],
    edges: [makeRelationshipGraphEdge()],
    graphVersion: "graph-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    mode: "all",
    nodes: [makeRelationshipGraphNode(), makeRelationshipGraphNode(RELATIONSHIP_FIXTURE.ciri)],
    updatedAt: null,
    ...overrides,
  };
}

export function makeRelationshipGraphEdge(
  overrides: Partial<CharacterGraphEdgeView> = {},
): CharacterGraphEdgeView {
  return {
    category: "family",
    description: null,
    descriptionHidden: false,
    directionality: "directed",
    id: RELATIONSHIP_FIXTURE.relationshipId,
    intensity: "medium",
    revealed: false,
    source: RELATIONSHIP_FIXTURE.geralt.id,
    sourceLabel: null,
    status: "active",
    target: RELATIONSHIP_FIXTURE.ciri.id,
    targetLabel: null,
    type: "guardian_of",
    typeHidden: false,
    ...overrides,
  };
}

export function makeRelationshipGraphNode(
  overrides: Partial<CharacterGraphNodeView> = {},
): CharacterGraphNodeView {
  return {
    clusterId: null,
    degree: 1,
    entityKind: "individual",
    id: RELATIONSHIP_FIXTURE.geralt.id,
    importance: "major",
    isFavorite: false,
    name: RELATIONSHIP_FIXTURE.geralt.name,
    ...overrides,
  };
}

export function makeRelationshipListItem(
  overrides: Partial<CharacterRelationshipListItemView> = {},
): CharacterRelationshipListItemView {
  return {
    bookSummaries: [],
    effectiveState: makeRelationshipBookState(),
    relationship: makeRelationshipEdge(),
    ...overrides,
  };
}

export function makeRelationshipPage(
  items: CharacterRelationshipListItemView[],
  meta: RelationshipPageMeta = {},
): PaginatedCharacterRelationshipListView {
  return {
    items,
    page: meta.page ?? 1,
    pagesCount: meta.pagesCount ?? (items.length === 0 ? 0 : 1),
    pageSize: 20,
    totalCount: meta.totalCount ?? items.length,
  };
}

export function makeRelationshipParticipant(
  overrides: Partial<SafeParticipantView> = {},
): SafeParticipantView {
  return {
    avatar: null,
    id: RELATIONSHIP_FIXTURE.geralt.id,
    name: RELATIONSHIP_FIXTURE.geralt.name,
    ...overrides,
  };
}

export function makeRosterCharacter({ id, name }: CharacterIdentity): BookCharacterRosterItem {
  return {
    avatar: null,
    characterId: id,
    descriptionPreview: null,
    displayName: null,
    entityKind: "individual",
    hiddenFields: [],
    id: `book-character-${id}`,
    importance: "major",
    isFavorite: false,
    isPovCharacter: false,
    name,
    portrait: null,
    roles: [],
    species: null,
    status: null,
    statusCustomText: null,
  };
}
