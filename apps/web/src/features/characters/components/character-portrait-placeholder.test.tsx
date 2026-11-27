import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { CharacterPortraitPlaceholder } from "./character-portrait-placeholder";

const PLACEHOLDER_ART = "character-portrait-placeholder.png";

function showPlaceholder(initial: string) {
  renderWithProviders(
    <CharacterPortraitPlaceholder sizes="104px">{initial}</CharacterPortraitPlaceholder>,
  );
}

describe("CharacterPortraitPlaceholder", () => {
  it("shows the portrait placeholder art", () => {
    showPlaceholder("Г");

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(PLACEHOLDER_ART),
    );
  });

  it("shows its content over the art", () => {
    showPlaceholder("Г");

    const initial = screen.getByText("Г");
    expect(initial).toBeVisible();
    expect(screen.getByRole("presentation").compareDocumentPosition(initial)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
