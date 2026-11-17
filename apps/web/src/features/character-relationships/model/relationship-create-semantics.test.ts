import type { RelationshipDirectionality } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  CreateOrientation,
  RelationshipCreateDraft,
  RelationshipCreateSemantics,
} from "./relationship-create-semantics";
import type { RelationshipFormField, RelationshipParticipant } from "./relationship-form-schema";

import {
  toCreateRelationshipRequest,
  toEffectiveCreateEdgeSignature,
  toEffectiveCreateEndpoints,
  toRelationshipCreateSemantics,
  toVisibleCreateParticipantField,
} from "./relationship-create-semantics";
import { relationshipBookStateDefaults } from "./relationship-form-input";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

type DraftChange = Partial<RelationshipCreateDraft>;

type EndpointCase = {
  directionality: RelationshipDirectionality;
  name: string;
  orientation: CreateOrientation;
  source: RelationshipParticipant;
  target: RelationshipParticipant;
};

type SignatureChangeCase = {
  after: DraftChange;
  afterOrientation: CreateOrientation;
  before: DraftChange;
  name: string;
};

type VisibleFieldCase = {
  directionality: RelationshipDirectionality;
  field: RelationshipFormField;
  name: string;
  orientation: CreateOrientation;
  visible: RelationshipFormField;
};

const GERALT: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt };
const CIRI: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri };
const YENNEFER: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.yennefer };
const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const SECOND_BOOK_ID = RELATIONSHIP_FIXTURE.secondBook.id;
const CUSTOM_SYMMETRIC: DraftChange = {
  customType: "Побратими",
  directionality: "symmetric",
  type: "custom",
};

function createDraft(change: DraftChange = {}): RelationshipCreateDraft {
  return {
    bookId: BOOK_ID,
    customType: "",
    directionality: "symmetric",
    source: GERALT,
    target: CIRI,
    type: "mentor_of",
    ...change,
  };
}

function createSemantics(
  change: DraftChange = {},
  orientation: CreateOrientation = "forward",
): RelationshipCreateSemantics {
  const semantics = toRelationshipCreateSemantics({ draft: createDraft(change), orientation });
  if (semantics === null) throw new Error("The create draft is incomplete");
  return semantics;
}

function signatureOf(change: DraftChange, orientation: CreateOrientation = "forward"): string {
  return toEffectiveCreateEdgeSignature(createSemantics(change, orientation));
}

describe("toEffectiveCreateEndpoints", () => {
  it.each<EndpointCase>([
    {
      directionality: "directed",
      name: "P02 a directed forward pair runs from A to B",
      orientation: "forward",
      source: GERALT,
      target: CIRI,
    },
    {
      directionality: "directed",
      name: "P03 a directed reverse pair runs from B to A",
      orientation: "reverse",
      source: CIRI,
      target: GERALT,
    },
    {
      directionality: "symmetric",
      name: "P01 a symmetric pair keeps the visible order",
      orientation: "forward",
      source: GERALT,
      target: CIRI,
    },
    {
      directionality: "symmetric",
      name: "P01 P06 a symmetric pair ignores a leftover reverse radio",
      orientation: "reverse",
      source: GERALT,
      target: CIRI,
    },
  ])("$name", ({ directionality, orientation, source, target }) => {
    expect(
      toEffectiveCreateEndpoints({
        directionality,
        orientation,
        participantA: GERALT,
        participantB: CIRI,
      }),
    ).toEqual({ source, target });
  });
});

describe("toRelationshipCreateSemantics", () => {
  it.each<{ change: DraftChange; name: string }>([
    { change: { bookId: null }, name: "R13 R14 without a book" },
    { change: { source: null }, name: "P08 without participant A" },
    { change: { target: null }, name: "P08 without participant B" },
    { change: { type: null }, name: "R13 without a type" },
    { change: { target: GERALT }, name: "R45 with the same character on both sides" },
    { change: { customType: "   ", type: "custom" }, name: "P15 with a blank custom name" },
  ])("stays incomplete $name", ({ change }) => {
    expect(
      toRelationshipCreateSemantics({ draft: createDraft(change), orientation: "forward" }),
    ).toBeNull();
  });

  it("P02 takes category and direction of a standard type from the catalog and drops the custom draft", () => {
    expect(
      createSemantics({ customType: "Побратими", directionality: "symmetric", type: "mentor_of" }),
    ).toEqual({
      bookId: BOOK_ID,
      category: "mentorship",
      customName: null,
      directionality: "directed",
      orientation: "forward",
      participantA: GERALT,
      participantB: CIRI,
      type: "mentor_of",
    });
  });

  it("P09 keeps the direction the author chose for a custom type and collapses its spaces", () => {
    expect(
      createSemantics({
        customType: "  Брати   по  зброї ",
        directionality: "directed",
        type: "custom",
      }),
    ).toMatchObject({
      category: "custom",
      customName: "Брати по зброї",
      directionality: "directed",
      type: "custom",
    });
  });

  it("T15 accepts a custom name of one character", () => {
    expect(createSemantics({ ...CUSTOM_SYMMETRIC, customType: " Б " }).customName).toBe("Б");
  });

  it("P15 accepts a custom name that fits 60 characters once its spaces collapse", () => {
    const customType = `${"а".repeat(30)}  ${"а".repeat(29)}`;

    expect(createSemantics({ ...CUSTOM_SYMMETRIC, customType }).customName).toBe(
      `${"а".repeat(30)} ${"а".repeat(29)}`,
    );
  });

  it("P15 rejects a custom name of 61 characters after its spaces collapse", () => {
    const customType = `${"а".repeat(30)} ${"а".repeat(30)}`;

    expect(
      toRelationshipCreateSemantics({
        draft: createDraft({ ...CUSTOM_SYMMETRIC, customType }),
        orientation: "forward",
      }),
    ).toBeNull();
  });
});

describe("toCreateRelationshipRequest", () => {
  it("E11 §5.1 P16 sends a custom symmetric pair as one state of the selected book with no labels", () => {
    expect(
      toCreateRelationshipRequest({
        allowFamilyCycle: false,
        bookState: relationshipBookStateDefaults(null),
        semantics: createSemantics(CUSTOM_SYMMETRIC),
      }),
    ).toEqual({
      allowFamilyCycle: false,
      category: "custom",
      customType: "Побратими",
      directionality: "symmetric",
      initialBookStates: [
        {
          bookId: BOOK_ID,
          description: null,
          endedAudioSeconds: null,
          endedChapter: null,
          endedPage: null,
          hideRelationshipAsSpoiler: false,
          intensity: null,
          introducedAudioSeconds: null,
          introducedChapter: null,
          introducedPage: null,
          isDescriptionSpoiler: false,
          isTypeSpoiler: false,
          status: "active",
        },
      ],
      isCanonical: false,
      sourceCharacterId: GERALT.id,
      sourceLabel: null,
      targetCharacterId: CIRI.id,
      targetLabel: null,
      type: "custom",
    });
  });

  it("R03 R46 carries the step-2 details into the one state of the chosen book", () => {
    expect(
      toCreateRelationshipRequest({
        allowFamilyCycle: false,
        bookState: {
          ...relationshipBookStateDefaults(null),
          description: "  Клятва Неочікуваного ",
          intensity: "high",
          introducedAudio: "05:30",
          introducedPage: 12,
        },
        semantics: createSemantics({ bookId: SECOND_BOOK_ID }),
      }).initialBookStates,
    ).toEqual([
      {
        bookId: SECOND_BOOK_ID,
        description: "Клятва Неочікуваного",
        endedAudioSeconds: null,
        endedChapter: null,
        endedPage: null,
        hideRelationshipAsSpoiler: false,
        intensity: "high",
        introducedAudioSeconds: 330,
        introducedChapter: null,
        introducedPage: 12,
        isDescriptionSpoiler: false,
        isTypeSpoiler: false,
        status: "active",
      },
    ]);
  });

  it.each(["mentor_of", "biological_parent_of", "biological_child_of"] as const)(
    "P03 P04 sends B as the source of a reversed %s and keeps the type",
    (type) => {
      expect(
        toCreateRelationshipRequest({
          allowFamilyCycle: false,
          bookState: relationshipBookStateDefaults(null),
          semantics: createSemantics({ type }, "reverse"),
        }),
      ).toMatchObject({ sourceCharacterId: CIRI.id, targetCharacterId: GERALT.id, type });
    },
  );

  it("P05 sends the same request after a directed A/B swap that inverts the radio", () => {
    const request = (semantics: RelationshipCreateSemantics) =>
      toCreateRelationshipRequest({
        allowFamilyCycle: false,
        bookState: relationshipBookStateDefaults(null),
        semantics,
      });

    expect(
      request(createSemantics({ source: CIRI, target: GERALT, type: "mentor_of" }, "reverse")),
    ).toEqual(request(createSemantics({ type: "mentor_of" }, "forward")));
  });

  it("E11 keeps both labels null after the author swaps the pair and reverses a directed type", () => {
    expect(
      toCreateRelationshipRequest({
        allowFamilyCycle: false,
        bookState: relationshipBookStateDefaults(null),
        semantics: createSemantics({ source: CIRI, target: GERALT, type: "mentor_of" }, "reverse"),
      }),
    ).toMatchObject({
      sourceCharacterId: GERALT.id,
      sourceLabel: null,
      targetCharacterId: CIRI.id,
      targetLabel: null,
    });
  });

  it("P01 P06 sends a symmetric pair in the visible order and leaves canonical order to the server", () => {
    expect(
      toCreateRelationshipRequest({
        allowFamilyCycle: false,
        bookState: relationshipBookStateDefaults(null),
        semantics: createSemantics({ source: CIRI, target: GERALT, type: "friend_of" }),
      }),
    ).toMatchObject({
      directionality: "symmetric",
      sourceCharacterId: CIRI.id,
      targetCharacterId: GERALT.id,
    });
  });

  it.each([true, false])("R26 sends allowFamilyCycle %s as given", (allowFamilyCycle) => {
    expect(
      toCreateRelationshipRequest({
        allowFamilyCycle,
        bookState: relationshipBookStateDefaults(null),
        semantics: createSemantics(),
      }).allowFamilyCycle,
    ).toBe(allowFamilyCycle);
  });
});

describe("toEffectiveCreateEdgeSignature", () => {
  it.each<SignatureChangeCase>([
    {
      after: { target: YENNEFER },
      afterOrientation: "forward",
      before: {},
      name: "P14 another participant",
    },
    { after: {}, afterOrientation: "reverse", before: {}, name: "P14 the direction radio" },
    {
      after: { type: "student_of" },
      afterOrientation: "forward",
      before: {},
      name: "P14 another type",
    },
    {
      after: { bookId: SECOND_BOOK_ID },
      afterOrientation: "forward",
      before: {},
      name: "P14 another book",
    },
    {
      after: { ...CUSTOM_SYMMETRIC, customType: "Посестри" },
      afterOrientation: "forward",
      before: CUSTOM_SYMMETRIC,
      name: "R26 another custom name",
    },
    {
      after: { ...CUSTOM_SYMMETRIC, directionality: "directed" },
      afterOrientation: "forward",
      before: CUSTOM_SYMMETRIC,
      name: "R26 a custom type turned directed",
    },
  ])("changes with $name", ({ after, afterOrientation, before }) => {
    expect(signatureOf(after, afterOrientation)).not.toBe(signatureOf(before));
  });

  it("P05 P14 stays the same after a clean directed A/B swap", () => {
    expect(signatureOf({ source: CIRI, target: GERALT }, "reverse")).toBe(signatureOf({}));
  });

  it("P06 stays the same after a symmetric A/B swap", () => {
    expect(signatureOf({ source: CIRI, target: GERALT, type: "friend_of" })).toBe(
      signatureOf({ type: "friend_of" }),
    );
  });

  it("P01 ignores the radio of a symmetric type", () => {
    expect(signatureOf({ type: "friend_of" }, "reverse")).toBe(signatureOf({ type: "friend_of" }));
  });

  it("R26 reads the custom name after normalization", () => {
    expect(signatureOf({ ...CUSTOM_SYMMETRIC, customType: "  Побратими " })).toBe(
      signatureOf(CUSTOM_SYMMETRIC),
    );
  });
});

describe("toVisibleCreateParticipantField", () => {
  it.each<VisibleFieldCase>([
    {
      directionality: "directed",
      field: "source",
      name: "P13 puts a server source error on card B of a reversed pair",
      orientation: "reverse",
      visible: "target",
    },
    {
      directionality: "directed",
      field: "target",
      name: "P13 puts a server target error on card A of a reversed pair",
      orientation: "reverse",
      visible: "source",
    },
    {
      directionality: "directed",
      field: "source",
      name: "P13 keeps a server source error on card A of a forward pair",
      orientation: "forward",
      visible: "source",
    },
    {
      directionality: "symmetric",
      field: "target",
      name: "P13 keeps a server target error on card B of a symmetric pair despite a reverse radio",
      orientation: "reverse",
      visible: "target",
    },
    {
      directionality: "directed",
      field: "type",
      name: "P13 leaves a type error where it is on a reversed pair",
      orientation: "reverse",
      visible: "type",
    },
    {
      directionality: "directed",
      field: "bookId",
      name: "P13 leaves a book error where it is on a reversed pair",
      orientation: "reverse",
      visible: "bookId",
    },
  ])("$name", ({ directionality, field, orientation, visible }) => {
    expect(toVisibleCreateParticipantField({ directionality, field, orientation })).toBe(visible);
  });
});
