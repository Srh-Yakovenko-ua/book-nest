import { describe, expect, it } from "vitest";

import type { CharacterMergePlanInput, LoserRelationshipRow } from "./character-merge.js";

import {
  aliasMergeKey,
  buildCharacterMergePlan,
  buildSurvivorRelationshipKeys,
  computeRelationshipCandidates,
  membershipMergeKey,
  resolveKeyedRepoint,
  resolveRelationshipPlan,
} from "./character-merge.js";

const USER = "11111111-1111-1111-1111-111111111111";
const SURVIVOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOSER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THIRD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOURTH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("resolveKeyedRepoint", () => {
  it("drops loser entries colliding with the survivor and moves the rest", () => {
    const plan = resolveKeyedRepoint({
      loserEntries: [
        { id: "l1", key: "book-a" },
        { id: "l2", key: "book-b" },
      ],
      survivorKeys: new Set(["book-a"]),
    });
    expect(plan.dropIds).toEqual(["l1"]);
    expect(plan.repointIds).toEqual(["l2"]);
  });

  it("dedupes loser entries that collide with each other", () => {
    const plan = resolveKeyedRepoint({
      loserEntries: [
        { id: "l1", key: "same" },
        { id: "l2", key: "same" },
      ],
      survivorKeys: new Set(),
    });
    expect(plan.dropIds).toEqual(["l2"]);
    expect(plan.repointIds).toEqual(["l1"]);
  });
});

describe("merge keys treat a null book as the global sentinel", () => {
  it("collapses null bookId aliases with the same name and type", () => {
    expect(aliasMergeKey({ bookId: null, normalizedName: "usul", type: "nickname" })).toBe(
      aliasMergeKey({ bookId: null, normalizedName: "usul", type: "nickname" }),
    );
    expect(aliasMergeKey({ bookId: "book-a", normalizedName: "usul", type: "nickname" })).not.toBe(
      aliasMergeKey({ bookId: null, normalizedName: "usul", type: "nickname" }),
    );
  });

  it("collapses null bookId memberships in the same group", () => {
    expect(membershipMergeKey({ bookId: null, groupId: "g" })).toBe(
      membershipMergeKey({ bookId: null, groupId: "g" }),
    );
  });
});

describe("computeRelationshipCandidates", () => {
  const loserRow = (overrides: Partial<LoserRelationshipRow>): LoserRelationshipRow => ({
    customType: null,
    directionality: "symmetric",
    id: "rel",
    sourceCharacterId: LOSER,
    sourceLabel: null,
    targetCharacterId: THIRD,
    targetLabel: null,
    type: "friend_of",
    ...overrides,
  });

  it("flags an edge between loser and survivor as a self-loop", () => {
    const { candidates } = computeRelationshipCandidates({
      loserId: LOSER,
      loserRows: [loserRow({ sourceCharacterId: LOSER, targetCharacterId: SURVIVOR })],
      survivorId: SURVIVOR,
      userId: USER,
    });
    expect(candidates).toEqual([{ dedupKey: null, id: "rel", isSelfLoop: true, repoint: null }]);
  });

  it("repoints a loser endpoint to the survivor and canonicalizes symmetric edges", () => {
    const { candidates, lockKeys } = computeRelationshipCandidates({
      loserId: LOSER,
      loserRows: [
        loserRow({
          directionality: "symmetric",
          sourceCharacterId: THIRD,
          sourceLabel: "the friend",
          targetCharacterId: LOSER,
          targetLabel: "the other",
          type: "friend_of",
        }),
      ],
      survivorId: SURVIVOR,
      userId: USER,
    });
    const [candidate] = candidates;
    if (candidate?.repoint == null) {
      throw new Error("expected a repointed candidate");
    }
    expect(
      [candidate.repoint.sourceCharacterId, candidate.repoint.targetCharacterId].sort(),
    ).toEqual([SURVIVOR, THIRD].sort());
    expect(lockKeys).toHaveLength(1);
  });
});

describe("resolveRelationshipPlan", () => {
  it("drops self-loops, drops duplicates of a survivor edge, and moves the rest", () => {
    const { candidates } = computeRelationshipCandidates({
      loserId: LOSER,
      loserRows: [
        {
          customType: null,
          directionality: "symmetric",
          id: "self",
          sourceCharacterId: LOSER,
          sourceLabel: null,
          targetCharacterId: SURVIVOR,
          targetLabel: null,
          type: "friend_of",
        },
        {
          customType: null,
          directionality: "symmetric",
          id: "dup",
          sourceCharacterId: LOSER,
          sourceLabel: null,
          targetCharacterId: THIRD,
          targetLabel: null,
          type: "spouse_of",
        },
        {
          customType: null,
          directionality: "directed",
          id: "moved",
          sourceCharacterId: LOSER,
          sourceLabel: null,
          targetCharacterId: FOURTH,
          targetLabel: null,
          type: "mentor_of",
        },
      ],
      survivorId: SURVIVOR,
      userId: USER,
    });
    const survivorKeys = buildSurvivorRelationshipKeys({
      rows: [
        {
          customType: null,
          directionality: "symmetric",
          sourceCharacterId: SURVIVOR,
          targetCharacterId: THIRD,
          type: "spouse_of",
        },
      ],
      userId: USER,
    });

    const plan = resolveRelationshipPlan({ candidates, survivorKeys });
    expect(plan.dropIds.sort()).toEqual(["dup", "self"]);
    expect(plan.repoints.map((repoint) => repoint.id)).toEqual(["moved"]);
  });
});

describe("buildCharacterMergePlan", () => {
  it("resolves every per-entity conflict deterministically and collects dropped media", () => {
    const { candidates } = computeRelationshipCandidates({
      loserId: LOSER,
      loserRows: [
        {
          customType: null,
          directionality: "symmetric",
          id: "rel-self",
          sourceCharacterId: LOSER,
          sourceLabel: null,
          targetCharacterId: SURVIVOR,
          targetLabel: null,
          type: "friend_of",
        },
        {
          customType: null,
          directionality: "directed",
          id: "rel-move",
          sourceCharacterId: LOSER,
          sourceLabel: null,
          targetCharacterId: FOURTH,
          targetLabel: null,
          type: "mentor_of",
        },
      ],
      survivorId: SURVIVOR,
      userId: USER,
    });

    const input: CharacterMergePlanInput = {
      loserAliases: [
        { bookId: null, id: "alias-dup", normalizedName: "usul", type: "nickname" },
        { bookId: null, id: "alias-move", normalizedName: "muaddib", type: "nickname" },
      ],
      loserAvatarMediaId: "media-avatar",
      loserBookCharacters: [
        { bookId: "book-shared", id: "bc-drop", portraitMediaId: "media-portrait", roleCount: 2 },
        { bookId: "book-solo", id: "bc-move", portraitMediaId: null, roleCount: 1 },
      ],
      loserForms: [
        { id: "form-drop", normalizedName: "true form", portraitMediaId: "media-form" },
        { id: "form-move", normalizedName: "alter ego", portraitMediaId: null },
      ],
      loserMemberships: [
        { bookId: null, groupId: "group-shared", id: "m-drop" },
        { bookId: null, groupId: "group-solo", id: "m-move" },
      ],
      loserTagIds: ["tag-dup", "tag-move"],
      loserTheoryCount: 3,
      relationshipCandidates: candidates,
      survivorAliasKeys: [{ bookId: null, normalizedName: "usul", type: "nickname" }],
      survivorBookIds: ["book-shared"],
      survivorFormKeys: ["true form"],
      survivorMembershipKeys: [{ bookId: null, groupId: "group-shared" }],
      survivorRelationshipKeys: new Set(),
      survivorTagIds: ["tag-dup"],
    };

    const plan = buildCharacterMergePlan(input);

    expect(plan.counts).toEqual({
      aliases: { dropped: 1, moved: 1 },
      appearances: { dropped: 1, moved: 1 },
      forms: { dropped: 1, moved: 1 },
      memberships: { dropped: 1, moved: 1 },
      relationships: { dropped: 1, moved: 1 },
      roles: { dropped: 2, moved: 1 },
      tags: { dropped: 1, moved: 1 },
      theories: { dropped: 0, moved: 3 },
    });
    expect(plan.dropBookCharacterIds).toEqual(["bc-drop"]);
    expect(plan.repointBookCharacterIds).toEqual(["bc-move"]);
    expect(plan.dropAliasIds).toEqual(["alias-dup"]);
    expect(plan.repointAliasIds).toEqual(["alias-move"]);
    expect(plan.dropFormIds).toEqual(["form-drop"]);
    expect(plan.repointFormIds).toEqual(["form-move"]);
    expect(plan.dropTagIds).toEqual(["tag-dup"]);
    expect(plan.repointTagIds).toEqual(["tag-move"]);
    expect(plan.dropMembershipIds).toEqual(["m-drop"]);
    expect(plan.repointMembershipIds).toEqual(["m-move"]);
    expect(plan.relationshipRepoints.map((repoint) => repoint.id)).toEqual(["rel-move"]);
    expect(plan.dropRelationshipIds).toEqual(["rel-self"]);
    expect(plan.droppedMediaIds.sort()).toEqual(["media-avatar", "media-form", "media-portrait"]);
  });
});
