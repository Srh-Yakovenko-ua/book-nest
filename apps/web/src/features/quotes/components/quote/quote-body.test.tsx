import "@testing-library/jest-dom/vitest";

import type { QuoteView } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeQuote, stubTextMetrics } from "../../model/quotes.fixtures";
import { QuoteBody } from "./quote-body";

const QUOTE_TEXT =
  "Я не повинен боятися. Страх — убивця розуму. Страх — маленька смерть, що несе цілковите знищення.";

let restoreMetrics: () => void = () => undefined;

function overflowText() {
  restoreMetrics();
  restoreMetrics = stubTextMetrics({ clientHeight: 100, scrollHeight: 500 });
}

function setupBody(overrides: Partial<QuoteView> = {}) {
  const onExpand = vi.fn();
  renderWithProviders(
    <QuoteBody onExpand={onExpand} quote={makeQuote({ text: QUOTE_TEXT, ...overrides })} />,
  );
  return onExpand;
}

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("QuoteBody preview", () => {
  it("offers no full view for a quote that fits the clamp", () => {
    setupBody();

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати повністю" })).not.toBeInTheDocument();
  });

  it("offers the full view once the text outgrows the clamp", () => {
    overflowText();

    setupBody();

    expect(screen.getByRole("button", { name: "Показати повністю" })).toBeInTheDocument();
  });

  it("asks the card to open the full view from the preview trigger", async () => {
    overflowText();
    const onExpand = setupBody();

    const trigger = screen.getByRole("button", { name: "Показати повністю" });
    await userEvent.click(trigger);

    expect(onExpand).toHaveBeenCalledWith(trigger);
  });

  it("leaves the preview clamped instead of expanding it in place", async () => {
    overflowText();
    setupBody();

    await userEvent.click(screen.getByRole("button", { name: "Показати повністю" }));

    expect(screen.getByText(QUOTE_TEXT)).toHaveClass("line-clamp-5");
    expect(screen.queryByText("Показати менше")).not.toBeInTheDocument();
  });
});

describe("QuoteBody spoiler", () => {
  it("keeps a spoiler quote behind the gate", () => {
    setupBody({ isSpoiler: true });

    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText("Ця цитата містить спойлер")).toBeInTheDocument();
    expect(screen.getByText("Вона може розкрити важливі події книги.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показати цитату" })).toBeInTheDocument();
  });

  it("asks the card to open the full view from the spoiler gate", async () => {
    const onExpand = setupBody({ isSpoiler: true });

    const trigger = screen.getByRole("button", { name: "Показати цитату" });
    await userEvent.click(trigger);

    expect(onExpand).toHaveBeenCalledWith(trigger);
  });
});
