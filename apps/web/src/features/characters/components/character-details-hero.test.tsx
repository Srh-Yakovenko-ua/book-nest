import type { CharacterDetailsView, MediaView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterDetailsHero } from "./character-details-hero";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const PLACEHOLDER_ART = "character-portrait-placeholder.png";

const portrait: MediaView = {
  contentType: "image/png",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 512,
  id: "media-portrait-1",
  kind: "avatar",
  name: "portrait.png",
  sizeBytes: 2048,
  urls: { card: "portrait-card.webp", full: "portrait-full.webp", thumb: "portrait-thumb.webp" },
  width: 512,
};

function showHero(character: CharacterDetailsView) {
  renderWithProviders(
    <CharacterDetailsHero
      appearance={undefined}
      character={character}
      editHref="/characters/char-1/edit"
      reveal={{ isRevealed: () => false, onReveal: () => Promise.resolve(true), pending: null }}
    />,
  );
}

describe("CharacterDetailsHero portrait", () => {
  it("shows the placeholder art for a character without a portrait", () => {
    showHero(makeCharacterDetails({ avatar: null, name: "цірі" }));

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(PLACEHOLDER_ART),
    );
  });

  it("puts the upper-cased first letter of the name on the placeholder", () => {
    showHero(makeCharacterDetails({ avatar: null, name: "цірі" }));

    expect(screen.getByText("Ц")).toBeVisible();
  });

  it("shows the portrait named after the character instead of the placeholder", () => {
    showHero(makeCharacterDetails({ avatar: portrait, name: "Ґеральт" }));

    const portraitImage = screen.getByRole("img", { name: "Ґеральт" });
    expect(portraitImage).toHaveAttribute("src", portrait.urls.card);
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });
});
