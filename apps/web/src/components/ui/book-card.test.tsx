import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { BookCard } from "./book-card";

const AUTHORS = ["Ursula K. Le Guin"];

const TITLE = "The Tombs of Atuan";

const SEED = "11111111-1111-4111-8111-111111111111";

const COVER = { alt: "Cover of The Tombs of Atuan", src: "https://covers.test/atuan.jpg" };

describe("BookCard cover", () => {
  it("names the fallback art after the title when the book has no cover", () => {
    renderWithProviders(<BookCard authors={AUTHORS} coverSeed={SEED} title={TITLE} />);

    expect(screen.getByRole("img", { name: TITLE })).toHaveAttribute(
      "src",
      expect.stringContaining("cover-2.png"),
    );
  });

  it("shows the real cover instead of the fallback art when the book has one", () => {
    renderWithProviders(
      <BookCard authors={AUTHORS} cover={COVER} coverSeed={SEED} title={TITLE} />,
    );

    expect(screen.getByRole("img", { name: COVER.alt })).toHaveAttribute("src", COVER.src);
    expect(screen.queryByRole("img", { name: TITLE })).not.toBeInTheDocument();
  });
});
