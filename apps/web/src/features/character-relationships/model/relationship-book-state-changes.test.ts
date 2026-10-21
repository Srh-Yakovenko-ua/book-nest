import { describe, expect, it } from "vitest";

import type { RelationshipBookStateFormInput } from "./relationship-form-schema";

import { bookStateChangedFromDefaults } from "./relationship-book-state-changes";
import { relationshipBookStateDefaults } from "./relationship-form-input";

type BookStateCase = {
  change: Partial<RelationshipBookStateFormInput>;
  name: string;
};

function changedFromDefaults(change: Partial<RelationshipBookStateFormInput>): boolean {
  return bookStateChangedFromDefaults({ ...relationshipBookStateDefaults(null), ...change });
}

describe("bookStateChangedFromDefaults", () => {
  it("R16 R54 reads untouched book details as unchanged", () => {
    expect(bookStateChangedFromDefaults(relationshipBookStateDefaults(null))).toBe(false);
  });

  it.each<BookStateCase>([
    { change: { description: "   " }, name: "a description of spaces" },
    { change: { introducedChapter: " \t " }, name: "a start chapter of whitespace" },
    { change: { endedChapter: "  " }, name: "an end chapter of spaces" },
    { change: { introducedAudio: "   " }, name: "a start audio time of spaces" },
    { change: { endedAudio: " " }, name: "an end audio time of a space" },
  ])("R16 R54 reads $name as unchanged", ({ change }) => {
    expect(changedFromDefaults(change)).toBe(false);
  });

  it("R16 R54 reads a spoiler flag toggled on and back off as unchanged", () => {
    const toggledOn = { ...relationshipBookStateDefaults(null), isTypeSpoiler: true };

    expect(bookStateChangedFromDefaults({ ...toggledOn, isTypeSpoiler: false })).toBe(false);
  });

  it("R16 R54 reads typed and then cleared text as unchanged", () => {
    const typed = { ...relationshipBookStateDefaults(null), description: "Клятва Неочікуваного" };

    expect(bookStateChangedFromDefaults({ ...typed, description: "" })).toBe(false);
  });

  it.each<BookStateCase>([
    { change: { status: "ended" }, name: "an ended status" },
    { change: { intensity: "high" }, name: "a chosen intensity" },
    { change: { description: "  Клятва Неочікуваного " }, name: "a description" },
    { change: { introducedChapter: "Розділ 3" }, name: "a start chapter" },
    { change: { endedChapter: "Епілог" }, name: "an end chapter" },
    { change: { introducedPage: 12 }, name: "a start page" },
    { change: { endedPage: 300 }, name: "an end page" },
    { change: { introducedAudio: "05:30" }, name: "a valid start audio time" },
    { change: { endedAudio: "1:05:30" }, name: "a valid end audio time" },
    { change: { introducedAudio: "пів години" }, name: "an unreadable start audio time" },
    { change: { endedAudio: "12:7" }, name: "an unreadable end audio time" },
    { change: { isTypeSpoiler: true }, name: "the type spoiler flag" },
    { change: { isDescriptionSpoiler: true }, name: "the description spoiler flag" },
    { change: { hideRelationshipAsSpoiler: true }, name: "the hide-as-spoiler flag" },
  ])("R16 R54 reads $name as a change that needs a confirm", ({ change }) => {
    expect(changedFromDefaults(change)).toBe(true);
  });
});
