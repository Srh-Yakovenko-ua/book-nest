import "@testing-library/jest-dom/vitest";

import type { QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeQuote, stubTextMetrics } from "../../model/quotes.fixtures";
import { QuoteBody } from "./quote-body";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUOTE_TEXT =
  "Я не повинен боятися. Страх — убивця розуму. Страх — маленька смерть, що несе цілковите знищення.";

const SHORT_TEXT = "Страх — убивця розуму.";

const BOOK_HREF = "/books/book-1";

let restoreMetrics: () => void = () => undefined;

function fitText() {
  restoreMetrics();
  restoreMetrics = stubTextMetrics({ clientHeight: 100, scrollHeight: 100 });
}

function overflowText() {
  restoreMetrics();
  restoreMetrics = stubTextMetrics({ clientHeight: 100, scrollHeight: 500 });
}

function renderBody(overrides: Partial<QuoteView> = {}) {
  return renderWithProviders(
    <QuoteBody bookHref={BOOK_HREF} quote={makeQuote({ text: QUOTE_TEXT, ...overrides })} />,
  );
}

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("QuoteBody preview", () => {
  it("offers no full view for a quote that fits the clamp", () => {
    renderBody();

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати повністю" })).not.toBeInTheDocument();
  });

  it("offers the full view once the text outgrows the clamp", () => {
    overflowText();

    renderBody();

    expect(screen.getByRole("button", { name: "Показати повністю" })).toBeInTheDocument();
  });

  it("opens the dialog with the whole text", async () => {
    overflowText();
    renderBody();

    await userEvent.click(screen.getByRole("button", { name: "Показати повністю" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(QUOTE_TEXT)).toBeInTheDocument();
  });

  it("leaves the preview clamped instead of expanding it in place", async () => {
    overflowText();
    renderBody();

    await userEvent.click(screen.getByRole("button", { name: "Показати повністю" }));
    const dialog = await screen.findByRole("dialog");
    const preview = screen.getAllByText(QUOTE_TEXT).find((node) => !dialog.contains(node));

    expect(preview).toHaveClass("line-clamp-5");
    expect(screen.queryByText("Показати менше")).not.toBeInTheDocument();
  });
});

describe("QuoteBody spoiler", () => {
  it("keeps a spoiler quote behind the gate", () => {
    renderBody({ isSpoiler: true });

    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText("Ця цитата містить спойлер")).toBeInTheDocument();
    expect(screen.getByText("Вона може розкрити важливі події книги.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показати цитату" })).toBeInTheDocument();
  });

  it("reveals the whole spoiler text in the dialog", async () => {
    renderBody({ isSpoiler: true });

    await userEvent.click(screen.getByRole("button", { name: "Показати цитату" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(QUOTE_TEXT)).toBeInTheDocument();
  });

  it("does not gate the spoiler a second time inside the dialog", async () => {
    renderBody({ isSpoiler: true });

    await userEvent.click(screen.getByRole("button", { name: "Показати цитату" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Ця цитата містить спойлер")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Показати цитату" }),
    ).not.toBeInTheDocument();
  });
});

describe("QuoteBody open dialog", () => {
  it("stays open after the text stops outgrowing the clamp", async () => {
    overflowText();
    const { rerender } = renderBody();

    await userEvent.click(screen.getByRole("button", { name: "Показати повністю" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fitText();
    rerender(<QuoteBody bookHref={BOOK_HREF} quote={makeQuote({ text: SHORT_TEXT })} />);

    expect(screen.queryByRole("button", { name: "Показати повністю" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays open after the quote stops being a spoiler", async () => {
    const { rerender } = renderBody({ isSpoiler: true });

    await userEvent.click(screen.getByRole("button", { name: "Показати цитату" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    rerender(
      <QuoteBody bookHref={BOOK_HREF} quote={makeQuote({ isSpoiler: false, text: QUOTE_TEXT })} />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
