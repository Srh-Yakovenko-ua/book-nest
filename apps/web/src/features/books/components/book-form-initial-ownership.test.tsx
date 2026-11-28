import type { OwnershipStatus, UserView } from "@app/shared";

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useAuthStore } from "@/features/auth";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { BookCreateOwnershipStatusSchema } from "../model/book-create-href";
import { makeBookDetailsView, makeBookView } from "./book-details.fixtures";
import { CreateBookForm } from "./create-book-form";
import { EditBookForm } from "./edit-book-form";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: routerPush, replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const ownershipCopy = messages.books.ownershipStatus;
const discard = messages.books.cancelConfirm;

const EDITED_BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const READER: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@book-nest.net",
  emailVerified: true,
  id: "user-reader",
  name: "Reader",
  nickname: "reader",
  role: "user",
};

const SUBMITTED_OWNERSHIP_SCHEMA = z.object({ ownershipStatus: z.string() });

function createFormFromQuery(ownershipStatus: string | undefined) {
  const parsed = BookCreateOwnershipStatusSchema.safeParse(ownershipStatus).data;
  return <CreateBookForm ownershipStatus={parsed} />;
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText(messages.books.fields.title), "Тестова книга");
  const authorInput = screen.getByPlaceholderText("Почніть вводити імʼя автора…");
  await userEvent.click(authorInput);
  await userEvent.type(authorInput, "Тест Автор");
  await userEvent.click(await screen.findByText("Створити «Тест Автор»"));
}

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function ownershipOption(status: OwnershipStatus): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: ownershipCopy.title })).getByRole("radio", {
    name: ownershipCopy.options[status],
  });
}

function reply(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { pathname } = new URL(String(input), "http://localhost");
  if (pathname.startsWith("/api/genres")) return jsonResponse([]);
  if (pathname === "/api/publishers/recent") return jsonResponse([]);
  if (pathname === `/api/books/${EDITED_BOOK_ID}`) {
    return jsonResponse(
      makeBookDetailsView({ id: EDITED_BOOK_ID, ownershipStatus: "want_to_buy" }),
    );
  }
  if (pathname === "/api/books" && init?.method === "POST") {
    return jsonResponse(makeBookView({ id: "book-created" }));
  }
  return jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 });
}

function submittedOwnershipStatus(): string {
  const request = fetchMock.mock.calls.find(
    ([input, init]) =>
      new URL(String(input), "http://localhost").pathname === "/api/books" &&
      init?.method === "POST",
  );
  const body = request?.[1]?.body;
  if (typeof body !== "string") throw new Error("no book was submitted");
  return SUBMITTED_OWNERSHIP_SCHEMA.parse(JSON.parse(body)).ownershipStatus;
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.getState().setSession("access-token", READER);
  fetchMock.mockReset();
  fetchMock.mockImplementation(reply);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => {
    useAuthStore.getState().clearSession();
  });
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CreateBookForm initial ownership status", () => {
  it.each(["owned", "want_to_buy", "borrowed_from_someone", "lent_to_someone"] as const)(
    "preselects %s when the entry point asks for it",
    (status) => {
      renderWithProviders(createFormFromQuery(status));

      expect(ownershipOption(status)).toBeChecked();
      expect(ownershipOption("none")).not.toBeChecked();
    },
  );

  it.each([
    { label: "a missing parameter", query: undefined },
    { label: "an unknown value", query: "stolen" },
    { label: "the delivery-only in_transit status", query: "in_transit" },
  ])("falls back to the default status for $label", ({ query }) => {
    renderWithProviders(createFormFromQuery(query));

    expect(ownershipOption("none")).toBeChecked();
    expect(ownershipOption("in_transit")).not.toBeChecked();
  });

  it("leaves an untouched preselected form without the discard dialog", async () => {
    renderWithProviders(createFormFromQuery("owned"));

    await userEvent.click(screen.getByRole("button", { name: messages.books.actions.cancel }));

    expect(routerPush).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("alertdialog", { name: discard.title })).not.toBeInTheDocument();
  });

  it("asks before leaving once the reader changes the preselected status", async () => {
    renderWithProviders(createFormFromQuery("owned"));

    await userEvent.click(ownershipOption("want_to_buy"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.actions.cancel }));

    expect(await screen.findByRole("alertdialog", { name: discard.title })).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("keeps the preselected status editable by hand", async () => {
    renderWithProviders(createFormFromQuery("owned"));

    await userEvent.click(ownershipOption("want_to_buy"));

    expect(ownershipOption("want_to_buy")).toBeChecked();
    expect(ownershipOption("owned")).not.toBeChecked();
  });

  it("saves the status the reader picked over the preselected one", async () => {
    renderWithProviders(createFormFromQuery("owned"));

    await userEvent.click(ownershipOption("want_to_buy"));
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: messages.books.actions.submit }));

    await waitFor(() => expect(submittedOwnershipStatus()).toBe("want_to_buy"));
  });

  it("shows the stored status in edit mode", async () => {
    renderWithProviders(<EditBookForm id={EDITED_BOOK_ID} />);

    await screen.findByRole("radiogroup", { name: ownershipCopy.title });

    expect(ownershipOption("want_to_buy")).toBeChecked();
    expect(ownershipOption("none")).not.toBeChecked();
  });
});
