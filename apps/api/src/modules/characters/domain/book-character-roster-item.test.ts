import type { BookCharacterRosterItem, MediaView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { SpeciesRefSource } from "../../species/index.js";
import type {
  RosterItemAppearanceSource,
  RosterItemCharacterSource,
} from "./book-character-roster-item.js";

import { toBookCharacterRosterItem } from "./book-character-roster-item.js";

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

const elf: SpeciesRefSource = { id: "species-elf", key: null, name: "Elf", names: [] };
const human: SpeciesRefSource = { id: "species-human", key: null, name: "Human", names: [] };

const neutralAppearance: RosterItemAppearanceSource = {
  description: null,
  descriptionIsSpoiler: false,
  displayName: null,
  displayNameIsSpoiler: false,
  id: "appearance-1",
  importance: "supporting",
  isPovCharacter: false,
  portraitIsSpoiler: false,
  portraitMediaId: null,
  roles: [],
  speciesOverride: null,
  speciesOverrideId: null,
  speciesOverrideIsSpoiler: false,
  status: "not_specified",
  statusCustomText: null,
  statusIsSpoiler: false,
};

const neutralCharacter: RosterItemCharacterSource = {
  entityKind: "individual",
  id: "character-1",
  isFavorite: false,
  name: "Paul Atreides",
  neutralDescription: null,
  species: null,
};

function role({
  id,
  isSpoiler = false,
  position,
}: {
  id: string;
  isSpoiler?: boolean;
  position: number;
}): RosterItemAppearanceSource["roles"][number] {
  return { customRole: `custom ${id}`, id, isSpoiler, position, roleType: "custom" };
}

function rosterItem({
  appearance = {},
  character = {},
}: {
  appearance?: Partial<RosterItemAppearanceSource>;
  character?: Partial<RosterItemCharacterSource>;
}): BookCharacterRosterItem {
  const source = { ...neutralAppearance, ...appearance };
  return toBookCharacterRosterItem({
    appearance: source,
    avatar: null,
    character: { ...neutralCharacter, ...character },
    portrait: source.portraitMediaId === null ? null : portraitView,
  });
}

describe("toBookCharacterRosterItem description preview", () => {
  it("prefers a visible book description over the neutral one", () => {
    const item = rosterItem({
      appearance: { description: "Book text" },
      character: { neutralDescription: "Neutral text" },
    });

    expect(item.descriptionPreview).toBe("Book text");
    expect(item.hiddenFields).toEqual([]);
  });

  it("falls back to the neutral description when the book one is a spoiler", () => {
    const item = rosterItem({
      appearance: { description: "Secret book text", descriptionIsSpoiler: true },
      character: { neutralDescription: "Neutral text" },
    });

    expect(item.descriptionPreview).toBe("Neutral text");
    expect(item.hiddenFields).toEqual(["description"]);
    expect(JSON.stringify(item)).not.toContain("Secret book text");
  });

  it("falls back to the neutral description when the book one is blank", () => {
    const item = rosterItem({
      appearance: { description: "   " },
      character: { neutralDescription: "Neutral text" },
    });

    expect(item.descriptionPreview).toBe("Neutral text");
  });

  it("omits the preview when neither text is available", () => {
    const item = rosterItem({
      appearance: { description: "Secret book text", descriptionIsSpoiler: true },
      character: { neutralDescription: "  " },
    });

    expect(item.descriptionPreview).toBeNull();
    expect(item.hiddenFields).toEqual(["description"]);
  });
});

describe("toBookCharacterRosterItem roles", () => {
  it("keeps visible roles in their persisted order", () => {
    const item = rosterItem({
      appearance: {
        roles: [role({ id: "a", position: 0 }), role({ id: "b", position: 1 })],
      },
    });

    expect(item.roles.map((visible) => visible.id)).toEqual(["a", "b"]);
    expect(item.hiddenFields).toEqual([]);
  });

  it("drops spoiler roles and reports the roles group once", () => {
    const item = rosterItem({
      appearance: {
        roles: [
          role({ id: "visible", position: 0 }),
          role({ id: "hidden-1", isSpoiler: true, position: 1 }),
          role({ id: "hidden-2", isSpoiler: true, position: 2 }),
        ],
      },
    });

    expect(item.roles.map((visible) => visible.id)).toEqual(["visible"]);
    expect(item.hiddenFields).toEqual(["roles"]);
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("hidden-1");
    expect(serialized).not.toContain("custom hidden-2");
  });
});

describe("toBookCharacterRosterItem species", () => {
  it("uses the global species when the book has no override", () => {
    expect(rosterItem({ character: { species: human } }).species?.id).toBe("species-human");
  });

  it("lets a visible book override win over the global species", () => {
    const item = rosterItem({
      appearance: { speciesOverride: elf, speciesOverrideId: elf.id },
      character: { species: human },
    });

    expect(item.species?.id).toBe("species-elf");
  });

  it("omits species entirely when the override is a spoiler", () => {
    const item = rosterItem({
      appearance: {
        speciesOverride: elf,
        speciesOverrideId: elf.id,
        speciesOverrideIsSpoiler: true,
      },
      character: { species: human },
    });

    expect(item.species).toBeNull();
    expect(item.hiddenFields).toEqual(["speciesOverride"]);
    expect(JSON.stringify(item)).not.toContain("species-elf");
  });

  it("ignores a spoiler flag on an empty override", () => {
    const item = rosterItem({
      appearance: { speciesOverrideIsSpoiler: true },
      character: { species: human },
    });

    expect(item.species?.id).toBe("species-human");
    expect(item.hiddenFields).toEqual([]);
  });

  it("returns null when no species is known", () => {
    expect(rosterItem({}).species).toBeNull();
  });
});

describe("toBookCharacterRosterItem status", () => {
  it("returns custom text for a visible other status", () => {
    const item = rosterItem({ appearance: { status: "other", statusCustomText: "Ghost" } });

    expect(item.status).toBe("other");
    expect(item.statusCustomText).toBe("Ghost");
  });

  it("drops custom text that belongs to a non-other status", () => {
    const item = rosterItem({ appearance: { status: "unknown", statusCustomText: "Stale" } });

    expect(item.status).toBe("unknown");
    expect(item.statusCustomText).toBeNull();
  });

  it("hides status and custom text together when the status is a spoiler", () => {
    const item = rosterItem({
      appearance: { status: "other", statusCustomText: "Ghost", statusIsSpoiler: true },
    });

    expect(item.status).toBeNull();
    expect(item.statusCustomText).toBeNull();
    expect(item.hiddenFields).toEqual(["status"]);
    expect(JSON.stringify(item)).not.toContain("Ghost");
  });

  it("keeps not_specified visible and unhidden even with a spoiler flag", () => {
    const item = rosterItem({ appearance: { statusIsSpoiler: true } });

    expect(item.status).toBe("not_specified");
    expect(item.hiddenFields).toEqual([]);
  });
});

describe("toBookCharacterRosterItem hidden groups", () => {
  it("lists every distinct hidden card group once", () => {
    const item = rosterItem({
      appearance: {
        description: "Secret",
        descriptionIsSpoiler: true,
        displayName: "Muad'Dib",
        displayNameIsSpoiler: true,
        portraitIsSpoiler: true,
        portraitMediaId: "media-portrait",
        roles: [
          role({ id: "r1", isSpoiler: true, position: 0 }),
          role({ id: "r2", isSpoiler: true, position: 1 }),
        ],
        speciesOverride: elf,
        speciesOverrideId: elf.id,
        speciesOverrideIsSpoiler: true,
        status: "dead",
        statusIsSpoiler: true,
      },
    });

    expect(item.hiddenFields).toEqual([
      "description",
      "displayName",
      "portrait",
      "roles",
      "speciesOverride",
      "status",
    ]);
    expect(item).toMatchObject({
      descriptionPreview: null,
      displayName: null,
      portrait: null,
      roles: [],
      species: null,
      status: null,
    });
  });
});
