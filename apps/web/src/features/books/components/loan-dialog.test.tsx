import "@testing-library/jest-dom/vitest";
import type { LoanContactView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { LoanDialog } from "./loan-dialog";

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const NEW_CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const fetchMock = vi.fn();

let searchResults: LoanContactView[] = [];

function contactView(overrides: Partial<LoanContactView> = {}): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_ID,
    loanCount: 2,
    name: "Ігор",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function contactsPage(items: LoanContactView[]) {
  return {
    counts: { active: items.length, all: items.length, archived: 0 },
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function loanCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${BOOK_ID}/loan`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function renderDialog() {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <LoanDialog
      book={makeBookView({ id: BOOK_ID, loanInfo: null, ownershipStatus: "none" })}
      direction="borrowed"
      onOpenChange={onOpenChange}
      open
    />,
  );
  return { onOpenChange };
}

beforeEach(() => {
  searchResults = [contactView()];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/loans/contacts")) {
      return Promise.resolve(jsonResponse(contactsPage(searchResults)));
    }
    if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
      return Promise.resolve(
        jsonResponse(makeBookView({ id: BOOK_ID, ownershipStatus: "borrowed_from_someone" })),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoanDialog", () => {
  it("sends the picked contact as the identity of the loan", async () => {
    const { onOpenChange } = renderDialog();

    await userEvent.click(screen.getByLabelText(messages.books.details.loan.borrowed.personName));
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(loanCall()).toBeDefined());
    const payload = JSON.parse(String(loanCall()?.[1].body));
    expect(payload).toMatchObject({ loanContactId: CONTACT_ID });
    expect(payload).not.toHaveProperty("personName");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends the contact created from the typed name", async () => {
    searchResults = [];
    const created = contactView({ id: NEW_CONTACT_ID, loanCount: 0, name: "Марта" });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/loans/contacts") && method === "POST") {
        return Promise.resolve(jsonResponse(created, 201));
      }
      if (url.includes("/api/loans/contacts")) {
        return Promise.resolve(jsonResponse(contactsPage(searchResults)));
      }
      if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "POST") {
        return Promise.resolve(
          jsonResponse(makeBookView({ id: BOOK_ID, ownershipStatus: "borrowed_from_someone" })),
        );
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    renderDialog();

    await userEvent.type(
      screen.getByLabelText(messages.books.details.loan.borrowed.personName),
      "Марта",
    );
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(
      await screen.findByRole("button", { name: messages.loans.contactCreate.submit }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(messages.books.details.loan.borrowed.personName)).toHaveValue(
        "Марта",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(loanCall()).toBeDefined());
    expect(JSON.parse(String(loanCall()?.[1].body))).toMatchObject({
      loanContactId: NEW_CONTACT_ID,
    });
  });

  it("offers no field for typing a contact detail on the loan", () => {
    renderDialog();

    expect(screen.queryByLabelText("Контакт")).not.toBeInTheDocument();
  });

  it("keeps the loan unsaved until a contact is picked", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    expect(await screen.findByText(messages.loans.contactPicker.required)).toBeInTheDocument();
    expect(loanCall()).toBeUndefined();
  });
});
