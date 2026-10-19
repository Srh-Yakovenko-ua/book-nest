import type {
  BookCharacterView,
  CharacterAppearanceBook,
  CharacterRevealFieldKey,
  MediaView,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  CharacterAppearanceSource,
  CharacterRoleSource,
  SummaryAppearanceSource,
} from "./character.mapper.js";

import {
  toBookCharacterView,
  toCharacterSummaryView,
  toMaskedBookCharacterView,
} from "./character.mapper.js";

type MaskedFieldCase = {
  field: CharacterRevealFieldKey;
  revealedValue: unknown;
  source: Partial<CharacterAppearanceSource>;
  valueOf: (view: BookCharacterView) => unknown;
};

type StaleFlagCase = {
  field: CharacterRevealFieldKey;
  source: Partial<CharacterAppearanceSource>;
};

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const book: CharacterAppearanceBook = { cover: null, id: "book-1", series: null, title: "Dune" };

const portraitView: MediaView = {
  contentType: "image/webp",
  createdAt: "2026-01-01T00:00:00.000Z",
  height: 512,
  id: "media-portrait",
  kind: "avatar",
  name: null,
  sizeBytes: 2048,
  urls: { card: "/card.webp", full: "/full.webp", thumb: "/thumb.webp" },
  width: 512,
};

const avatarView: MediaView = { ...portraitView, id: "media-avatar" };

const neutralAppearance: CharacterAppearanceSource = {
  appearanceNotes: null,
  appearanceNotesIsSpoiler: false,
  attitude: null,
  bookId: "book-1",
  characterId: "character-1",
  createdAt,
  description: null,
  descriptionIsSpoiler: false,
  displayName: null,
  displayNameIsSpoiler: false,
  firstAppearanceAudioSeconds: null,
  firstAppearanceChapter: null,
  firstAppearanceNote: null,
  firstAppearancePage: null,
  id: "appearance-1",
  importance: "supporting",
  isPovCharacter: false,
  isUnreliableNarrator: false,
  isUnreliableNarratorSpoiler: false,
  narratorType: null,
  personalImpression: null,
  personalImpressionIsSpoiler: false,
  portraitIsSpoiler: false,
  portraitMediaId: null,
  roles: [],
  sortOrder: null,
  speciesOverride: null,
  speciesOverrideId: null,
  speciesOverrideIsSpoiler: false,
  status: "not_specified",
  statusCustomText: null,
  statusIsSpoiler: false,
  updatedAt: createdAt,
};

const neutralSummaryAppearance: SummaryAppearanceSource = {
  displayName: null,
  displayNameIsSpoiler: false,
  id: "appearance-1",
  importance: "supporting",
  isPovCharacter: false,
  portraitIsSpoiler: false,
  portraitMediaId: null,
  status: "not_specified",
  statusIsSpoiler: false,
};

const summaryCharacter = {
  entityKind: "individual",
  id: "character-1",
  isFavorite: false,
  name: "Paul Atreides",
};

const supportingRole: CharacterRoleSource = {
  customRole: null,
  id: "role-supporting",
  isSpoiler: false,
  position: 0,
  roleType: "supporting",
};

const spoilerAntagonistRole: CharacterRoleSource = {
  customRole: null,
  id: "role-antagonist",
  isSpoiler: true,
  position: 1,
  roleType: "antagonist",
};

const maskedFieldCases: MaskedFieldCase[] = [
  {
    field: "displayName",
    revealedValue: "Muad'Dib",
    source: { displayName: "Muad'Dib", displayNameIsSpoiler: true },
    valueOf: (view) => view.displayName,
  },
  {
    field: "portrait",
    revealedValue: portraitView,
    source: { portraitIsSpoiler: true, portraitMediaId: "media-portrait" },
    valueOf: (view) => view.portrait,
  },
  {
    field: "status",
    revealedValue: "dead",
    source: { status: "dead", statusIsSpoiler: true },
    valueOf: (view) => view.status,
  },
  {
    field: "speciesOverride",
    revealedValue: "species-fremen",
    source: {
      speciesOverride: { id: "species-fremen", key: null, name: "Fremen", names: [] },
      speciesOverrideId: "species-fremen",
      speciesOverrideIsSpoiler: true,
    },
    valueOf: (view) => view.speciesOverride?.id ?? null,
  },
  {
    field: "description",
    revealedValue: "Becomes the Kwisatz Haderach",
    source: { description: "Becomes the Kwisatz Haderach", descriptionIsSpoiler: true },
    valueOf: (view) => view.description,
  },
  {
    field: "personalImpression",
    revealedValue: "Turns cold by the end",
    source: { personalImpression: "Turns cold by the end", personalImpressionIsSpoiler: true },
    valueOf: (view) => view.personalImpression,
  },
  {
    field: "appearanceNotes",
    revealedValue: "Blue-within-blue eyes",
    source: { appearanceNotes: "Blue-within-blue eyes", appearanceNotesIsSpoiler: true },
    valueOf: (view) => view.appearanceNotes,
  },
];

const staleFlagCases: StaleFlagCase[] = [
  { field: "displayName", source: { displayName: "   ", displayNameIsSpoiler: true } },
  { field: "portrait", source: { portraitIsSpoiler: true, portraitMediaId: null } },
  { field: "status", source: { status: "not_specified", statusIsSpoiler: true } },
  { field: "speciesOverride", source: { speciesOverrideId: null, speciesOverrideIsSpoiler: true } },
  { field: "description", source: { description: "  \n ", descriptionIsSpoiler: true } },
  {
    field: "personalImpression",
    source: { personalImpression: "", personalImpressionIsSpoiler: true },
  },
  { field: "appearanceNotes", source: { appearanceNotes: null, appearanceNotesIsSpoiler: true } },
];

function maskedView({
  revealed = [],
  source,
}: {
  revealed?: CharacterRevealFieldKey[];
  source: Partial<CharacterAppearanceSource>;
}): BookCharacterView {
  const appearance = { ...neutralAppearance, ...source };
  return toMaskedBookCharacterView({
    appearance,
    book,
    portrait: appearance.portraitMediaId === null ? null : portraitView,
    revealedFields: new Set(revealed),
  });
}

describe("toMaskedBookCharacterView field masking", () => {
  it.each(maskedFieldCases)(
    "masks a spoiler $field holding a value to null and lists it in hiddenFields",
    ({ field, source, valueOf }) => {
      const view = maskedView({ source });

      expect(valueOf(view)).toBeNull();
      expect(view.hiddenFields).toEqual([field]);
    },
  );

  it.each(maskedFieldCases)(
    "returns the spoiler $field value once its reveal key is sent",
    ({ field, revealedValue, source, valueOf }) => {
      const view = maskedView({ revealed: [field], source });

      expect(valueOf(view)).toEqual(revealedValue);
      expect(view.hiddenFields).toEqual([]);
    },
  );

  it.each(maskedFieldCases)(
    "keeps the spoiler $field withheld when only the other reveal keys are sent",
    ({ field, source, valueOf }) => {
      const otherKeys = maskedFieldCases
        .map((fieldCase) => fieldCase.field)
        .filter((otherField) => otherField !== field);
      const view = maskedView({ revealed: otherKeys, source });

      expect(valueOf(view)).toBeNull();
      expect(view.hiddenFields).toEqual([field]);
    },
  );

  it.each(staleFlagCases)(
    "lists no $field in hiddenFields when its spoiler flag is set but the value is empty",
    ({ source }) => {
      const view = maskedView({ source });

      expect(view.hiddenFields).toEqual([]);
    },
  );
});

describe("toMaskedBookCharacterView status semantics", () => {
  it("hides the custom status text together with a spoiler 'other' status", () => {
    const view = maskedView({
      source: {
        status: "other",
        statusCustomText: "Ascended to the Golden Path",
        statusIsSpoiler: true,
      },
    });

    expect(view.status).toBeNull();
    expect(view.statusCustomText).toBeNull();
    expect(view.hiddenFields).toEqual(["status"]);
    expect(JSON.stringify(view)).not.toContain("Golden Path");
  });

  it("returns the custom status text with a revealed 'other' status", () => {
    const view = maskedView({
      revealed: ["status"],
      source: {
        status: "other",
        statusCustomText: "Ascended to the Golden Path",
        statusIsSpoiler: true,
      },
    });

    expect(view.status).toBe("other");
    expect(view.statusCustomText).toBe("Ascended to the Golden Path");
  });

  it("treats a spoiler 'unknown' status as a value worth masking", () => {
    const view = maskedView({ source: { status: "unknown", statusIsSpoiler: true } });

    expect(view.status).toBeNull();
    expect(view.hiddenFields).toEqual(["status"]);
  });

  it("returns 'not_specified' unmasked when its spoiler flag is stale", () => {
    const view = maskedView({ source: { status: "not_specified", statusIsSpoiler: true } });

    expect(view.status).toBe("not_specified");
  });

  it("drops a stale custom status text left behind on a spoiler 'not_specified' status", () => {
    const view = maskedView({
      source: {
        status: "not_specified",
        statusCustomText: "Ascended to the Golden Path",
        statusIsSpoiler: true,
      },
    });

    expect(view.status).toBe("not_specified");
    expect(view.statusCustomText).toBeNull();
    expect(JSON.stringify(view)).not.toContain("Golden Path");
  });

  it("drops a stale custom status text on a revealed non-'other' status", () => {
    const view = maskedView({
      revealed: ["status"],
      source: { status: "dead", statusCustomText: "Ascended to the Golden Path" },
    });

    expect(view.status).toBe("dead");
    expect(view.statusCustomText).toBeNull();
  });
});

describe("toMaskedBookCharacterView independence of appearance notes and portrait", () => {
  it("keeps the portrait when only the appearance notes are a spoiler", () => {
    const view = maskedView({
      source: {
        appearanceNotes: "Blue-within-blue eyes",
        appearanceNotesIsSpoiler: true,
        portraitMediaId: "media-portrait",
      },
    });

    expect(view.portrait).toEqual(portraitView);
    expect(view.appearanceNotes).toBeNull();
    expect(view.hiddenFields).toEqual(["appearanceNotes"]);
  });

  it("keeps the appearance notes when only the portrait is a spoiler", () => {
    const view = maskedView({
      source: {
        appearanceNotes: "Blue-within-blue eyes",
        portraitIsSpoiler: true,
        portraitMediaId: "media-portrait",
      },
    });

    expect(view.appearanceNotes).toBe("Blue-within-blue eyes");
    expect(view.portrait).toBeNull();
    expect(view.hiddenFields).toEqual(["portrait"]);
  });
});

describe("toMaskedBookCharacterView roles", () => {
  it("withholds spoiler roles and lists a bare roles marker with no count", () => {
    const view = maskedView({ source: { roles: [supportingRole, spoilerAntagonistRole] } });

    expect(view.roles.map((role) => role.roleType)).toEqual(["supporting"]);
    expect(view.hiddenFields).toEqual(["roles"]);
  });

  it("returns every role, spoiler ones included, once roles are revealed", () => {
    const view = maskedView({
      revealed: ["roles"],
      source: { roles: [supportingRole, spoilerAntagonistRole] },
    });

    expect(view.roles.map((role) => [role.roleType, role.isSpoiler])).toEqual([
      ["supporting", false],
      ["antagonist", true],
    ]);
    expect(view.hiddenFields).toEqual([]);
  });

  it("lists no roles marker when no role is a spoiler", () => {
    const view = maskedView({ source: { roles: [supportingRole] } });

    expect(view.hiddenFields).toEqual([]);
  });
});

describe("toBookCharacterView hiddenFields", () => {
  it("lists only the flagged fields that hold a value", () => {
    const view = toBookCharacterView({
      appearance: {
        ...neutralAppearance,
        description: "Becomes the Kwisatz Haderach",
        descriptionIsSpoiler: true,
        displayName: " ",
        displayNameIsSpoiler: true,
        portraitIsSpoiler: true,
        status: "unknown",
        statusIsSpoiler: true,
      },
      book,
      portrait: null,
    });

    expect(view.hiddenFields).toEqual(["description", "status"]);
  });
});

describe("toCharacterSummaryView masking", () => {
  it("masks a spoiler display name, portrait and status that hold values", () => {
    const view = toCharacterSummaryView({
      appearance: {
        ...neutralSummaryAppearance,
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        portraitIsSpoiler: true,
        portraitMediaId: "media-portrait",
        status: "dead",
        statusIsSpoiler: true,
      },
      avatar: avatarView,
      character: summaryCharacter,
      portrait: portraitView,
    });

    expect(view).toMatchObject({
      avatar: avatarView,
      displayName: null,
      hiddenFields: ["displayName", "portrait", "status"],
      name: "Paul Atreides",
      portrait: null,
      status: null,
    });
  });

  it("lists no hiddenFields for stale display name, portrait and status flags", () => {
    const view = toCharacterSummaryView({
      appearance: {
        ...neutralSummaryAppearance,
        displayName: "  ",
        displayNameIsSpoiler: true,
        portraitIsSpoiler: true,
        portraitMediaId: null,
        status: "not_specified",
        statusIsSpoiler: true,
      },
      avatar: avatarView,
      character: summaryCharacter,
      portrait: null,
    });

    expect(view.hiddenFields).toEqual([]);
    expect(view.status).toBe("not_specified");
  });
});
