import type { CreateCharacterRelationship, UpsertRelationshipBookState } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  RelationshipBookStateFormInput,
  RelationshipFormValues,
  RelationshipParticipant,
} from "./relationship-form-schema";

import {
  toCreateRelationshipRequest,
  toRelationshipCreateSemantics,
} from "./relationship-create-semantics";
import {
  relationshipBookStateDefaults,
  relationshipCreateDefaults,
  toRelationshipBookStateInput,
} from "./relationship-form-input";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

const GERALT: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt };
const CIRI: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri };

const CATALOG_DIRECTIONS = [
  { category: "family", held: "symmetric", sent: "directed", type: "guardian_of" },
  { category: "family", held: "directed", sent: "symmetric", type: "sibling_of" },
  { category: "mentorship", held: "symmetric", sent: "directed", type: "mentor_of" },
  { category: "romantic", held: "directed", sent: "symmetric", type: "engaged_to" },
] as const;

const AUDIO_POSITIONS = [
  { seconds: 3930, text: "1:05:30" },
  { seconds: 330, text: "05:30" },
  { seconds: 1, text: "0:00:01" },
  { seconds: 43200, text: "12:00:00" },
] as const;

function bookStateInput(
  overrides: Partial<RelationshipBookStateFormInput>,
): UpsertRelationshipBookState {
  return toRelationshipBookStateInput({ ...relationshipBookStateDefaults(null), ...overrides });
}

function createInput(overrides: Partial<RelationshipFormValues>): CreateCharacterRelationship {
  const values: RelationshipFormValues = {
    ...relationshipCreateDefaults({ bookId: RELATIONSHIP_FIXTURE.book.id, focusCharacter: GERALT }),
    target: CIRI,
    type: "guardian_of",
    ...overrides,
  };
  const semantics = toRelationshipCreateSemantics({ draft: values, orientation: "forward" });
  if (semantics === null) throw new Error("The create draft is incomplete");
  return toCreateRelationshipRequest({
    allowFamilyCycle: false,
    bookState: values.bookState,
    semantics,
  });
}

describe("toCreateRelationshipInput direction", () => {
  it.each(CATALOG_DIRECTIONS)(
    "sends the catalog direction $sent for $type even when the form held $held",
    ({ category, held, sent, type }) => {
      expect(createInput({ category, directionality: held, type }).directionality).toBe(sent);
    },
  );

  it.each(["directed", "symmetric"] as const)(
    "sends the direction %s the author chose for a custom type",
    (directionality) => {
      expect(
        createInput({ category: "custom", customType: "побратими", directionality, type: "custom" })
          .directionality,
      ).toBe(directionality);
    },
  );

  it("sends the custom type name only for a custom type", () => {
    expect(createInput({ customType: "побратими", type: "guardian_of" }).customType).toBeNull();
  });
});

describe("toRelationshipBookStateInput audio positions", () => {
  it.each(AUDIO_POSITIONS)("stores $text as $seconds seconds", ({ seconds, text }) => {
    expect(bookStateInput({ introducedAudio: text }).introducedAudioSeconds).toBe(seconds);
  });

  it("stores the end position separately from the start", () => {
    expect(bookStateInput({ endedAudio: "05:30", introducedAudio: "1:05:30" })).toMatchObject({
      endedAudioSeconds: 330,
      introducedAudioSeconds: 3930,
    });
  });

  it("stores an empty audio position as no position", () => {
    expect(bookStateInput({ introducedAudio: "" }).introducedAudioSeconds).toBeNull();
  });
});
