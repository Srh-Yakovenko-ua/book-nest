import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { BookCoverFallback } from "./book-cover-fallback";

const SEEDS = {
  ink: "11111111-1111-4111-8111-111111111111",
  paper: "00000000-0000-4000-8000-000000000001",
} as const;

const TITLE_TONES = [
  { otherToneClass: "text-cover-paper", seed: SEEDS.ink, toneClass: "text-cover-ink" },
  { otherToneClass: "text-cover-ink", seed: SEEDS.paper, toneClass: "text-cover-paper" },
] as const;

const TITLE = "A Wizard of Earthsea";

const COVER_ALT = "Cover of A Wizard of Earthsea";

const ARIA_HIDDEN = '[aria-hidden="true"], [aria-hidden="true"] *';

describe("BookCoverFallback", () => {
  it("shows the cover art picked for the seed", () => {
    renderWithProviders(<BookCoverFallback alt={COVER_ALT} seed={SEEDS.paper} sizes="8rem" />);

    expect(screen.getByRole("img", { name: COVER_ALT })).toHaveAttribute(
      "src",
      expect.stringContaining("cover-3.png"),
    );
  });

  it("writes the title over the art and hides it from assistive technology", () => {
    renderWithProviders(<BookCoverFallback seed={SEEDS.paper} sizes="8rem" title={TITLE} />);

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.queryByText(TITLE, { ignore: ARIA_HIDDEN })).not.toBeInTheDocument();
  });

  it.each(TITLE_TONES)("colours the title with $toneClass on its cover", (tone) => {
    renderWithProviders(<BookCoverFallback seed={tone.seed} sizes="8rem" title={TITLE} />);

    expect(screen.getByText(TITLE)).toHaveClass(tone.toneClass);
    expect(screen.getByText(TITLE)).not.toHaveClass(tone.otherToneClass);
  });

  it("draws only the art when no title is given", () => {
    renderWithProviders(<BookCoverFallback alt={TITLE} seed={SEEDS.ink} sizes="8rem" />);

    expect(screen.getByRole("img", { name: TITLE })).toHaveAttribute(
      "src",
      expect.stringContaining("cover-2.png"),
    );
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("keeps the art decorative when the alt is empty", () => {
    renderWithProviders(<BookCoverFallback seed={SEEDS.ink} sizes="8rem" />);

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("cover-2.png"),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
