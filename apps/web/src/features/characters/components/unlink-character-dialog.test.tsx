import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeCharacterFact } from "../model/characters.fixtures";
import { UnlinkCharacterDialog } from "./unlink-character-dialog";

const FACTS_PATH = "/api/books/book-1/characters/char-1/facts";

const MESSAGES = {
  counting: "Рахуємо факти персонажа в цій книзі…",
  countUnavailable:
    "Не вдалося дізнатися, скільки фактів буде видалено. Усі факти персонажа в цій книзі буде видалено назавжди.",
  sevenFactsLost:
    "7 фактів про персонажа в цій книзі буде видалено назавжди. Якщо знову додати персонажа до книги, факти не відновляться.",
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let countRequests: { path: string; query: Record<string, string> }[];
let respondToCount: () => Promise<Response>;

function confirmButton(): HTMLElement {
  return screen.getByRole("button", { name: "Прибрати" });
}

function deferredResponse() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function factsCount(totalCount: number): Response {
  return jsonResponse({
    items: totalCount === 0 ? [] : [makeCharacterFact()],
    page: 1,
    pagesCount: totalCount,
    pageSize: 1,
    totalCount,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(onConfirm: () => void = vi.fn()) {
  renderWithProviders(
    <UnlinkCharacterDialog
      isUnlinking={false}
      onConfirm={onConfirm}
      onOpenChange={vi.fn()}
      open
      scope={{ bookId: "book-1", characterId: "char-1" }}
    />,
  );
}

beforeEach(() => {
  countRequests = [];
  respondToCount = () => Promise.resolve(factsCount(7));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname !== FACTS_PATH) {
      return Promise.reject(new Error(`unexpected ${url.pathname}`));
    }
    countRequests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
    return respondToCount();
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnlinkCharacterDialog facts impact", () => {
  it("warns how many facts of this book the unlink deletes, counted by the server", async () => {
    renderDialog();

    expect(await screen.findByText(MESSAGES.sevenFactsLost)).toBeInTheDocument();
  });

  it("counts with a single-item request for the facts of that character in that book", async () => {
    renderDialog();

    await screen.findByText(MESSAGES.sevenFactsLost);

    expect(countRequests).toEqual([
      { path: FACTS_PATH, query: { pageNumber: "1", pageSize: "1" } },
    ]);
  });

  it("says nothing about facts when the character has none in this book", async () => {
    respondToCount = () => Promise.resolve(factsCount(0));
    renderDialog();

    await waitFor(() => expect(confirmButton()).toBeEnabled());

    expect(screen.queryByText(/назавжди/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("explains that the count is unknown instead of claiming zero when counting fails", async () => {
    respondToCount = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderDialog();

    expect(await screen.findByText(MESSAGES.countUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(/^0 /)).not.toBeInTheDocument();
  });

  it("keeps Confirm disabled until the facts are counted", async () => {
    const count = deferredResponse();
    respondToCount = () => count.promise;
    renderDialog();

    expect(await screen.findByText(MESSAGES.counting)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    count.release(factsCount(7));

    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });

  it("still lets the user confirm once counting has failed", async () => {
    respondToCount = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    const onConfirm = vi.fn();
    renderDialog(onConfirm);
    await screen.findByText(MESSAGES.countUnavailable);

    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
