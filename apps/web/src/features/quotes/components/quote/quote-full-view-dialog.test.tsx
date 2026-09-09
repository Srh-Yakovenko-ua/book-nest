import "@testing-library/jest-dom/vitest";

import type { Nullable, QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeQuote } from "../../model/quotes.fixtures";
import { QuoteFullViewDialog } from "./quote-full-view-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUOTE_TEXT =
  "Я не повинен боятися. Страх — убивця розуму. Страх — маленька смерть, що несе цілковите знищення.";

const TRIGGER_LABEL = "Показати повністю";

const BOOK_HREF = "/books/book-1";

type DialogHarnessProps = {
  bookHref: Nullable<string>;
  quote: QuoteView;
};

function DialogHarness({ bookHref, quote }: DialogHarnessProps) {
  const triggerRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">
        {TRIGGER_LABEL}
      </button>
      <QuoteFullViewDialog
        bookHref={bookHref}
        onOpenChange={setOpen}
        open={open}
        quote={quote}
        triggerRef={triggerRef}
      />
    </>
  );
}

async function openDialog(overrides: Partial<QuoteView> = {}): Promise<HTMLElement> {
  return openHarness({ bookHref: BOOK_HREF, quote: makeQuote({ text: QUOTE_TEXT, ...overrides }) });
}

async function openHarness(props: DialogHarnessProps): Promise<HTMLElement> {
  renderWithProviders(<DialogHarness {...props} />);
  await userEvent.click(trigger());
  return screen.findByRole("dialog");
}

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: TRIGGER_LABEL });
}

describe("QuoteFullViewDialog", () => {
  it("shows the whole quote text", async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByText(QUOTE_TEXT)).toBeInTheDocument();
  });

  it("names itself after the book and describes itself with the author", async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveAccessibleName("Дюна");
    expect(dialog).toHaveAccessibleDescription("Френк Герберт");
  });

  it("links the title to the book page", async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByRole("link", { name: "Дюна" })).toHaveAttribute(
      "href",
      "/books/book-1",
    );
  });

  it("falls back to the unknown-author label when the book has no author", async () => {
    const dialog = await openDialog({ book: { ...makeQuote().book, firstAuthorName: "" } });

    expect(dialog).toHaveAccessibleDescription("Автор невідомий");
  });

  it("shows the chapter and the page", async () => {
    const dialog = await openDialog({ chapter: "Розділ III", page: 87 });

    expect(within(dialog).getByText("Розділ III · стор. 87")).toBeInTheDocument();
  });

  it("shows the comment", async () => {
    const dialog = await openDialog({ comment: "Улюблена мантра проти страху." });

    expect(within(dialog).getByText("Коментар")).toBeInTheDocument();
    expect(within(dialog).getByText("Улюблена мантра проти страху.")).toBeInTheDocument();
  });

  it("marks a spoiler quote with the badge while still showing its text", async () => {
    const dialog = await openDialog({ isSpoiler: true });

    expect(within(dialog).getByText("Спойлер")).toBeInTheDocument();
    expect(within(dialog).getByText(QUOTE_TEXT)).toBeInTheDocument();
  });

  it("carries the favorite button and the actions menu", async () => {
    const dialog = await openDialog();

    expect(
      within(dialog).getByRole("button", { name: "Додати цитату в улюблені" }),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Дії для цитати" }));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Перейти до книги",
      "Скопіювати цитату",
      "Видалити",
    ]);
  });

  it("scrolls its own body and the quote block instead of growing past the viewport", async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveClass("max-h-[90dvh]", "overflow-y-auto");
    expect(within(dialog).getByText(QUOTE_TEXT)).toHaveClass("max-h-[45vh]", "overflow-y-auto");
  });

  it("closes on Escape and hands focus back to the trigger", async () => {
    await openDialog();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger()).toHaveFocus());
  });
});

describe("QuoteFullViewDialog quote block", () => {
  it("exposes the scrollable quote block as a focusable named region", async () => {
    const dialog = await openDialog();

    const block = within(dialog).getByRole("region", { name: "Текст цитати" });
    expect(block).toHaveTextContent(QUOTE_TEXT);
    expect(block).toHaveAttribute("tabindex", "0");
    expect(block).toHaveClass("focus-visible:ring-3", "focus-visible:ring-ring/50");
  });

  it("reaches the quote block with the keyboard", async () => {
    const dialog = await openHarness({ bookHref: null, quote: makeQuote({ text: QUOTE_TEXT }) });

    await userEvent.tab();

    expect(within(dialog).getByRole("region", { name: "Текст цитати" })).toHaveFocus();
  });
});

describe("QuoteFullViewDialog without a book link", () => {
  it("renders the cover and the title as plain nodes", async () => {
    const dialog = await openHarness({ bookHref: null, quote: makeQuote({ text: QUOTE_TEXT }) });

    expect(within(dialog).getByText("Дюна")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "Обкладинка книги «Дюна»" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("leaves the book entry out of the actions menu", async () => {
    const dialog = await openHarness({ bookHref: null, quote: makeQuote({ text: QUOTE_TEXT }) });

    await userEvent.click(within(dialog).getByRole("button", { name: "Дії для цитати" }));

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Скопіювати цитату",
      "Видалити",
    ]);
  });
});
