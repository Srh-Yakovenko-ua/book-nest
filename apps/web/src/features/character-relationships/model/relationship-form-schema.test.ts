import { CreateCharacterRelationshipSchema, UpsertRelationshipBookStateSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type {
  RelationshipBookStateFormInput,
  RelationshipFormInput,
  RelationshipFormMessages,
  RelationshipParticipant,
} from "./relationship-form-schema";

import { relationshipCreateDefaults } from "./relationship-form-input";
import { buildRelationshipFormSchema } from "./relationship-form-schema";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

type LengthLimit = {
  build: (text: string) => RelationshipFormInput;
  max: number;
  message: string;
  path: string;
  serverAccepts: (text: string) => boolean;
};

const MESSAGES = {
  audioInvalid: "audio-invalid",
  bookRequired: "book-required",
  chapterTooLong: "chapter-too-long",
  customTypeRequired: "custom-type-required",
  customTypeTooLong: "custom-type-too-long",
  descriptionTooLong: "description-too-long",
  labelTooLong: "label-too-long",
  pageInvalid: "page-invalid",
  participantRequired: "participant-required",
  typeRequired: "type-required",
} as const satisfies RelationshipFormMessages;

const GERALT: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt };
const CIRI: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri };

const AUDIO_PATH = "bookState.introducedAudio";

const schema = buildRelationshipFormSchema({
  messages: MESSAGES,
  rules: { book: "optional", participants: "required" },
});

const LENGTH_LIMITS: readonly LengthLimit[] = [
  {
    build: (text) => catalogInput({ sourceLabel: text }),
    max: 120,
    message: MESSAGES.labelTooLong,
    path: "sourceLabel",
    serverAccepts: (text) =>
      CreateCharacterRelationshipSchema.shape.sourceLabel.safeParse(text).success,
  },
  {
    build: (text) => catalogInput({ targetLabel: text }),
    max: 120,
    message: MESSAGES.labelTooLong,
    path: "targetLabel",
    serverAccepts: (text) =>
      CreateCharacterRelationshipSchema.shape.targetLabel.safeParse(text).success,
  },
  {
    build: (text) => customInput(text),
    max: 60,
    message: MESSAGES.customTypeTooLong,
    path: "customType",
    serverAccepts: (text) =>
      CreateCharacterRelationshipSchema.shape.customType.safeParse(text).success,
  },
  {
    build: (text) => withBookState({ description: text }),
    max: 5000,
    message: MESSAGES.descriptionTooLong,
    path: "bookState.description",
    serverAccepts: (text) =>
      UpsertRelationshipBookStateSchema.shape.description.safeParse(text).success,
  },
  {
    build: (text) => withBookState({ introducedChapter: text }),
    max: 200,
    message: MESSAGES.chapterTooLong,
    path: "bookState.introducedChapter",
    serverAccepts: (text) =>
      UpsertRelationshipBookStateSchema.shape.introducedChapter.safeParse(text).success,
  },
  {
    build: (text) => withBookState({ endedChapter: text }),
    max: 200,
    message: MESSAGES.chapterTooLong,
    path: "bookState.endedChapter",
    serverAccepts: (text) =>
      UpsertRelationshipBookStateSchema.shape.endedChapter.safeParse(text).success,
  },
];

function catalogInput(overrides: Partial<RelationshipFormInput> = {}): RelationshipFormInput {
  return {
    ...relationshipCreateDefaults({ bookId: RELATIONSHIP_FIXTURE.book.id, focusCharacter: GERALT }),
    target: CIRI,
    type: "guardian_of",
    ...overrides,
  };
}

function customInput(customType: string): RelationshipFormInput {
  return catalogInput({ category: "custom", customType, type: "custom" });
}

function introducedAudioMessages(value: string): string[] {
  return messagesAt({ input: withBookState({ introducedAudio: value }), path: AUDIO_PATH });
}

function messagesAt({ input, path }: { input: RelationshipFormInput; path: string }): string[] {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join(".") === path)
    .map((issue) => issue.message);
}

function withBookState(overrides: Partial<RelationshipBookStateFormInput>): RelationshipFormInput {
  const input = catalogInput();
  return { ...input, bookState: { ...input.bookState, ...overrides } };
}

describe("relationship form schema: type", () => {
  it("accepts a complete relationship with a catalog type", () => {
    expect(schema.safeParse(catalogInput()).success).toBe(true);
  });

  it("asks for a type until one is chosen", () => {
    expect(messagesAt({ input: catalogInput({ type: null }), path: "type" })).toEqual([
      MESSAGES.typeRequired,
    ]);
  });

  it("requires a name for a custom type and does not count spaces as one", () => {
    expect(messagesAt({ input: customInput("   "), path: "customType" })).toEqual([
      MESSAGES.customTypeRequired,
    ]);
  });

  it("accepts a custom type once it has a name", () => {
    expect(schema.safeParse(customInput("побратими")).success).toBe(true);
  });

  it("asks for both characters", () => {
    const input = catalogInput({ source: null, target: null });

    expect([
      ...messagesAt({ input, path: "source" }),
      ...messagesAt({ input, path: "target" }),
    ]).toEqual([MESSAGES.participantRequired, MESSAGES.participantRequired]);
  });
});

describe("relationship form schema: length limits", () => {
  it.each(LENGTH_LIMITS)(
    "caps $path at $max characters, the limit the server schema enforces",
    ({ build, max, message, path, serverAccepts }) => {
      const longest = "я".repeat(max);
      const tooLong = "я".repeat(max + 1);

      expect(messagesAt({ input: build(longest), path })).toEqual([]);
      expect(messagesAt({ input: build(tooLong), path })).toEqual([message]);
      expect(serverAccepts(longest)).toBe(true);
      expect(serverAccepts(tooLong)).toBe(false);
    },
  );
});

describe("relationship form schema: audio positions", () => {
  it.each(["1:05:30", "05:30", "0:00:01", "12:00:00"])("accepts %s", (value) => {
    expect(introducedAudioMessages(value)).toEqual([]);
  });

  it("leaves the audio position optional", () => {
    expect(introducedAudioMessages("")).toEqual([]);
  });

  it.each(["0:00", "00:00", "0:00:00", "5:3", "1:75:00", "90", "1:05:30:10", "година"])(
    "rejects %s",
    (value) => {
      expect(introducedAudioMessages(value)).toEqual([MESSAGES.audioInvalid]);
    },
  );

  it("checks the end position the same way as the start", () => {
    expect(
      messagesAt({ input: withBookState({ endedAudio: "00:00" }), path: "bookState.endedAudio" }),
    ).toEqual([MESSAGES.audioInvalid]);
  });
});
