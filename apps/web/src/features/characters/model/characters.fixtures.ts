import type {
  BookCharacterSummaryView,
  BookCharacterView,
  CharacterDeletionPreview,
  CharacterDeletionResult,
  CharacterDetailsView,
  CharacterGlobalSummaryView,
  CharacterSummaryView,
} from "@app/shared";

type CharacterSummaryPage = {
  items: CharacterSummaryView[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export function makeBookCharacterSummary(
  overrides: Partial<BookCharacterSummaryView> = {},
): BookCharacterSummaryView {
  return {
    bookId: "book-1",
    byImportance: { central: 1, episodic: 0, major: 0, mentioned: 0, supporting: 0 },
    favoritesCount: 0,
    hasHiddenRecords: false,
    povCount: 0,
    top: [],
    totalVisibleCharacters: 1,
    ...overrides,
  };
}

export function makeBookCharacterView(
  overrides: Partial<BookCharacterView> = {},
): BookCharacterView {
  return {
    appearanceNotes: null,
    appearanceNotesIsSpoiler: false,
    attitude: null,
    bookId: "book-1",
    characterId: "char-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    descriptionIsSpoiler: false,
    displayName: null,
    displayNameIsSpoiler: false,
    firstAppearanceAudioSeconds: null,
    firstAppearanceChapter: null,
    firstAppearanceNote: null,
    firstAppearancePage: null,
    hiddenFields: [],
    hidePresenceAsSpoiler: false,
    id: "book-char-1",
    importance: "central",
    isPovCharacter: false,
    narratorType: null,
    personalImpression: null,
    personalImpressionIsSpoiler: false,
    portrait: null,
    portraitIsSpoiler: false,
    roles: [],
    sortOrder: null,
    speciesOverride: null,
    speciesOverrideIsSpoiler: false,
    status: null,
    statusCustomText: null,
    statusIsSpoiler: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCharacterDetails(
  overrides: Partial<CharacterDetailsView> = {},
): CharacterDetailsView {
  return {
    aliases: [],
    appearances: [],
    archivedAt: null,
    avatar: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    customGender: null,
    entityKind: "individual",
    forms: [],
    gender: "unknown",
    globalAttitude: null,
    hiddenFields: [],
    hideProfileAsSpoiler: false,
    id: "char-1",
    isFavorite: false,
    name: "Ґеральт",
    neutralDescription: null,
    pronouns: null,
    species: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCharacterGlobalSummary(
  overrides: Partial<CharacterGlobalSummaryView> = {},
): CharacterGlobalSummaryView {
  return {
    appearanceCount: 0,
    archivedAt: null,
    avatar: null,
    customGender: null,
    entityKind: "individual",
    gender: "unknown",
    globalAttitude: null,
    hideProfileAsSpoiler: false,
    id: "char-1",
    isFavorite: false,
    name: "Ґеральт із Рівії",
    neutralDescription: null,
    pronouns: null,
    species: null,
    tags: [],
    ...overrides,
  };
}

export function makeCharacterSummary(
  overrides: Partial<CharacterSummaryView> = {},
): CharacterSummaryView {
  return {
    avatar: null,
    characterId: "char-1",
    displayName: null,
    entityKind: "individual",
    hiddenFields: [],
    id: "book-char-1",
    importance: "central",
    isFavorite: false,
    name: "Ґеральт",
    portrait: null,
    status: null,
    ...overrides,
  };
}

export function makeCharacterSummaryPage(
  items: CharacterSummaryView[],
  overrides: Partial<CharacterSummaryPage> = {},
): CharacterSummaryPage {
  return {
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
    ...overrides,
  };
}

export function makeDeletionPreview(
  overrides: Partial<CharacterDeletionPreview> = {},
): CharacterDeletionPreview {
  return {
    aliasCount: 2,
    appearanceCount: 3,
    roleCount: 1,
    tagCount: 0,
    ...overrides,
  };
}

export function makeDeletionResult(
  overrides: Partial<CharacterDeletionResult> = {},
): CharacterDeletionResult {
  return {
    characterId: "11111111-1111-4111-8111-111111111111",
    deletedAt: "2026-07-23T10:00:00.000Z",
    purgeAt: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}
