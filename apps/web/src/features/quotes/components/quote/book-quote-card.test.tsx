import "@testing-library/jest-dom/vitest";

import type { QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeQuote } from "../../model/quotes.fixtures";
import { BookQuoteCard } from "./book-quote-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUOTE_TEXT = "Страх — убивця розуму.";

function renderCard(overrides: Partial<QuoteView> = {}) {
  return renderWithProviders(<BookQuoteCard quote={makeQuote(overrides)} />);
}

describe("BookQuoteCard", () => {
  it("shows the quote text with its chapter and page", () => {
    renderCard({ chapter: "Розділ III", page: 87 });

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(screen.getByText("Розділ III · стор. 87")).toBeInTheDocument();
  });

  it("repeats neither the book title nor its author on the book page", () => {
    renderCard();

    expect(screen.queryByText("Дюна")).not.toBeInTheDocument();
    expect(screen.queryByText("Френк Герберт")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("leaves the book entry out of the actions menu", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Дії для цитати" }));

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Скопіювати цитату",
      "Видалити",
    ]);
  });

  it("marks a spoiler quote with the badge and hides its text", () => {
    renderCard({ isSpoiler: true });

    expect(screen.getByText("Спойлер")).toBeInTheDocument();
    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показати цитату" })).toBeInTheDocument();
  });

  it("opens the full view without linking back to the page it sits on", async () => {
    renderCard({ isSpoiler: true });

    await userEvent.click(screen.getByRole("button", { name: "Показати цитату" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(within(dialog).getByText("Дюна")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the comment under its own label", () => {
    renderCard({ comment: "Улюблена мантра проти страху." });

    expect(screen.getByText("Коментар")).toBeInTheDocument();
    expect(screen.getByText("Улюблена мантра проти страху.")).toBeInTheDocument();
  });
});
