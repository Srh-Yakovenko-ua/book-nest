import { describe, expect, it } from "vitest";

import type { GroupMembershipSource, GroupSource } from "./character-group.mapper.js";

import {
  toCharacterGroupDetailsView,
  toCharacterGroupSummaryView,
} from "./character-group.mapper.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const group: GroupSource = {
  createdAt,
  customType: "  ",
  description: "House of the North",
  id: "group-1",
  isSpoiler: false,
  name: "House Stark",
  seriesId: "series-1",
  type: "house",
  updatedAt,
};

const member: GroupMembershipSource = {
  bookId: "book-1",
  character: { name: "Eddard Stark" },
  characterId: "char-1",
  createdAt,
  id: "membership-1",
  isSpoiler: false,
  role: "  Lord  ",
  status: null,
  updatedAt,
};

describe("toCharacterGroupSummaryView", () => {
  it("keeps the name and empty hiddenFields when not masked", () => {
    const view = toCharacterGroupSummaryView({ group, memberCount: 3, nameHidden: false });
    expect(view).toMatchObject({
      customType: null,
      description: "House of the North",
      hiddenFields: [],
      id: "group-1",
      isSpoiler: false,
      memberCount: 3,
      name: "House Stark",
      seriesId: "series-1",
      type: "house",
    });
    expect(view.createdAt).toBe(createdAt.toISOString());
  });

  it("masks name, description and customType and flags them when nameHidden is true", () => {
    const view = toCharacterGroupSummaryView({
      group: { ...group, customType: "Northern lords" },
      memberCount: 0,
      nameHidden: true,
    });
    expect(view.name).toBeNull();
    expect(view.description).toBeNull();
    expect(view.customType).toBeNull();
    expect(view.hiddenFields).toEqual(["customType", "description", "name"]);
  });
});

describe("toCharacterGroupDetailsView", () => {
  it("maps members, derives memberCount and trims membership text", () => {
    const view = toCharacterGroupDetailsView({ group, members: [member], nameHidden: false });
    expect(view.memberCount).toBe(1);
    expect(view.members).toHaveLength(1);
    expect(view.members[0]).toMatchObject({
      bookId: "book-1",
      characterId: "char-1",
      characterName: "Eddard Stark",
      role: "Lord",
      status: null,
    });
  });

  it("reports memberCount as the number of visible members passed in", () => {
    const view = toCharacterGroupDetailsView({ group, members: [], nameHidden: true });
    expect(view.memberCount).toBe(0);
    expect(view.members).toEqual([]);
    expect(view.name).toBeNull();
  });
});
