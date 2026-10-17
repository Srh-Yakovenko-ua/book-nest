import "@testing-library/jest-dom/vitest";
import type { CharacterFactView } from "@app/shared";
import type { ReactNode } from "react";

import { CHARACTER_FACT_ERROR_CODES } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeCharacterFact } from "../model/characters.fixtures";
import { CharacterFactsList } from "./character-facts-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

mockIntersectionObserver();

const FACTS_PATH = "/api/books/book-1/characters/char-1/facts";
const FACT_PATH = /^\/api\/books\/book-1\/characters\/char-1\/facts\/(?<factId>[^/]+)$/;

const silverSword = makeCharacterFact({ id: "fact-1", title: "Срібний меч" });
const wolfMedallion = makeCharacterFact({ id: "fact-2", title: "Медальйон школи Вовка" });
const roach = makeCharacterFact({ id: "fact-3", title: "Плотва" });

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let deleteRequests: string[];
let listRequestCount: number;
let respondToDelete: (factId: string) => Promise<Response>;
let storedFacts: CharacterFactView[];

function deferredResponse() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function factHeading(title: string): HTMLElement {
  return screen.getByRole("heading", { hidden: true, level: 3, name: title });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openDeleteFor(title: string): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole("button", { name: `Дії з фактом «${title}»` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));
  return screen.findByRole("alertdialog", { name: "Видалити факт?" });
}

function removeStored(factId: string) {
  storedFacts = storedFacts.filter((fact) => fact.id !== factId);
}

async function renderList() {
  renderWithProviders(
    <NuqsTestingAdapter>
      <CharacterFactsList bookId="book-1" characterId="char-1" />
    </NuqsTestingAdapter>,
  );
  await screen.findByRole("heading", { level: 3, name: "Срібний меч" });
}

beforeEach(() => {
  deleteRequests = [];
  listRequestCount = 0;
  storedFacts = [silverSword, wolfMedallion, roach];
  respondToDelete = (factId) => {
    removeStored(factId);
    return Promise.resolve(new Response(null, { status: 204 }));
  };

  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === FACTS_PATH) {
      listRequestCount += 1;
      return Promise.resolve(
        jsonResponse({
          items: storedFacts,
          page: 1,
          pagesCount: 1,
          pageSize: 20,
          totalCount: storedFacts.length,
        }),
      );
    }
    const factId = FACT_PATH.exec(url.pathname)?.groups?.factId;
    if (factId !== undefined && init?.method === "DELETE") {
      deleteRequests.push(factId);
      return respondToDelete(factId);
    }
    return Promise.reject(new Error(`unexpected ${init?.method ?? "GET"} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeleteCharacterFactDialog in the facts list", () => {
  it("uses one confirmation for the whole list that follows the fact it was opened for", async () => {
    await renderList();
    const firstDialog = await openDeleteFor("Срібний меч");
    await userEvent.click(within(firstDialog).getByRole("button", { name: "Скасувати" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await openDeleteFor("Плотва");

    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("«Плотва»");
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent("Срібний меч");
  });

  it("names the fact that will be deleted", async () => {
    await renderList();

    const dialog = await openDeleteFor("Медальйон школи Вовка");

    expect(
      within(dialog).getByText(
        "Факт «Медальйон школи Вовка» буде видалено назавжди. Цю дію не можна скасувати.",
      ),
    ).toBeInTheDocument();
  });

  it("deletes the confirmed fact and removes its card", async () => {
    await renderList();
    const dialog = await openDeleteFor("Медальйон школи Вовка");

    await userEvent.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteRequests).toEqual(["fact-2"]);
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 3, name: "Медальйон школи Вовка" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("disables both actions while the delete is in flight", async () => {
    const pendingDelete = deferredResponse();
    respondToDelete = () => pendingDelete.promise;
    await renderList();
    const dialog = await openDeleteFor("Медальйон школи Вовка");

    await userEvent.click(within(dialog).getByRole("button", { name: "Видалити" }));

    expect(await within(dialog).findByRole("button", { name: "Видалення…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeDisabled();
    pendingDelete.release(new Response(null, { status: 204 }));
  });

  it("keeps the dialog and the card when the delete fails", async () => {
    respondToDelete = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    await renderList();
    const dialog = await openDeleteFor("Медальйон школи Вовка");

    await userEvent.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Видалити" })).toBeEnabled(),
    );
    expect(deleteRequests).toEqual(["fact-2"]);
    expect(screen.getByRole("alertdialog", { name: "Видалити факт?" })).toBeInTheDocument();
    expect(factHeading("Медальйон школи Вовка")).toBeInTheDocument();
  });

  it("refreshes the list when the fact was already deleted elsewhere", async () => {
    respondToDelete = (factId) => {
      removeStored(factId);
      return Promise.resolve(
        jsonResponse({ code: CHARACTER_FACT_ERROR_CODES.notFound, message: "Fact not found" }, 404),
      );
    };
    await renderList();
    const dialog = await openDeleteFor("Медальйон школи Вовка");

    await userEvent.click(within(dialog).getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(listRequestCount).toBe(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 3, name: "Медальйон школи Вовка" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
