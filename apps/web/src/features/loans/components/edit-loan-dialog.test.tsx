import "@testing-library/jest-dom/vitest";
import type { LoanContactListItemView, LoanListItemView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { EditLoanDialog } from "./edit-loan-dialog";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CONTACT_IDS = {
  ihor: "22222222-2222-4222-8222-222222222222",
  olya: "11111111-1111-4111-8111-111111111111",
} as const;

const fetchMock = vi.fn();

let searchResults: LoanContactListItemView[] = [];

function contactPicker() {
  return screen.getByLabelText(messages.books.details.loan.lent.personName);
}

function contactsPage(items: LoanContactListItemView[]) {
  return {
    counts: { active: items.length, all: items.length, archived: 0 },
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
  };
}

function contactView(overrides: Partial<LoanContactListItemView> = {}): LoanContactListItemView {
  return {
    activeBorrowedCount: 0,
    activeLentCount: 0,
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_IDS.ihor,
    loanCount: 1,
    name: "Ігор",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

function editCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${BOOK_ID}/loan`) &&
      (init?.method ?? "GET").toUpperCase() === "PATCH",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function loanItem(): LoanListItemView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Дж. Р. Р. Толкін",
      id: BOOK_ID,
      originalTitle: null,
      ownershipStatus: "lent_to_someone",
      publisher: null,
      title: "Гобіт",
    },
    contact: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    expectedReturnDate: "2026-02-01",
    id: "loan-1",
    loanContactId: CONTACT_IDS.olya,
    loanDate: "2026-01-05",
    loanUiStatus: "on_time",
    note: null,
    personName: "Оля",
    remindBeforeDays: null,
    remindToReturn: false,
    type: "lent_to_someone",
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

function renderDialog() {
  renderWithProviders(<EditLoanDialog loan={loanItem()} onOpenChange={vi.fn()} open />);
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
    if (url.includes(`/api/books/${BOOK_ID}/loan`) && method === "PATCH") {
      return Promise.resolve(jsonResponse(makeBookView({ id: BOOK_ID })));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditLoanDialog", () => {
  it("keeps the contact saved on the loan when only the dates change", async () => {
    renderDialog();

    expect(contactPicker()).toHaveValue("Оля");

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(editCall()).toBeDefined());
    const payload = JSON.parse(String(editCall()?.[1].body));
    expect(payload).toMatchObject({ loanContactId: CONTACT_IDS.olya });
    expect(payload).not.toHaveProperty("personName");
  });

  it("offers no field for editing the contact detail of the person", () => {
    renderDialog();

    expect(screen.queryByLabelText("Контакт")).not.toBeInTheDocument();
  });

  it("sends no contact detail with the loan edit", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(editCall()).toBeDefined());
    expect(JSON.parse(String(editCall()?.[1].body))).not.toHaveProperty("contact");
  });

  it("moves the loan to the contact picked from the list", async () => {
    renderDialog();

    await userEvent.click(contactPicker());
    await userEvent.click(await screen.findByText("Ігор"));
    await userEvent.click(screen.getByRole("button", { name: messages.books.details.loan.submit }));

    await waitFor(() => expect(editCall()).toBeDefined());
    expect(JSON.parse(String(editCall()?.[1].body))).toMatchObject({
      loanContactId: CONTACT_IDS.ihor,
    });
  });
});
