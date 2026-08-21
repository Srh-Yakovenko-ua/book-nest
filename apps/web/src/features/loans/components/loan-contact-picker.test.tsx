import "@testing-library/jest-dom/vitest";
import type { LoanContactView } from "@app/shared";

import { LOAN_CONTACT_ERROR_CODES } from "@app/shared";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { LoanContactSelection } from "../model/loan-contact-selection";

import { LoanContactPicker } from "./loan-contact-picker";

const PICKER_LABEL = "Кому даєте";

const copy = messages.loans.contactCreate;

const CONTACT_IDS = {
  ihor: "11111111-1111-4111-8111-111111111111",
  marta: "22222222-2222-4222-8222-222222222222",
} as const;

const fetchMock = vi.fn();

let searchResults: LoanContactView[] = [];
let respondToCreate: () => Response;
let respondToLookup: () => Response;

function contactView(overrides: Partial<LoanContactView> = {}): LoanContactView {
  return {
    archivedAt: null,
    contact: null,
    createdAt: "2026-01-10T10:00:00.000Z",
    id: CONTACT_IDS.ihor,
    loanCount: 3,
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

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith("/api/loans/contacts") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function restoreCall() {
  return fetchMock.mock.calls.find(([url]) => String(url).includes("/restore")) as
    [string, RequestInit] | undefined;
}

function Harness({ onChange }: { onChange: (selection: LoanContactSelection | null) => void }) {
  const [value, setValue] = useState<LoanContactSelection | null>(null);

  return (
    <div>
      <label htmlFor="contact-picker">{PICKER_LABEL}</label>
      <LoanContactPicker
        id="contact-picker"
        invalid={false}
        label={PICKER_LABEL}
        onChange={(selection) => {
          setValue(selection);
          onChange(selection);
        }}
        placeholder="Імʼя людини"
        value={value}
      />
    </div>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderPicker() {
  const onChange = vi.fn<(selection: LoanContactSelection | null) => void>();
  renderWithProviders(<Harness onChange={onChange} />);
  return { input: screen.getByLabelText(PICKER_LABEL), onChange };
}

beforeEach(() => {
  searchResults = [];
  respondToCreate = () => jsonResponse(contactView({ id: CONTACT_IDS.marta, name: "Марта" }), 201);
  respondToLookup = () => jsonResponse({ message: "not found" }, 404);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/restore") && method === "POST") {
      return Promise.resolve(jsonResponse(contactView({ id: CONTACT_IDS.marta, name: "Марта" })));
    }
    if (url.includes("/api/loans/contacts/by-name")) {
      return Promise.resolve(respondToLookup());
    }
    if (url.endsWith("/api/loans/contacts") && method === "POST") {
      return Promise.resolve(respondToCreate());
    }
    if (url.includes("/api/loans/contacts")) {
      return Promise.resolve(jsonResponse(contactsPage(searchResults)));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoanContactPicker", () => {
  it("reports the contact picked from the list together with its loan count", async () => {
    searchResults = [contactView()];
    const { input, onChange } = renderPicker();

    await userEvent.click(input);

    expect(await screen.findByText("Ігор")).toBeInTheDocument();
    expect(screen.getByText("3 позики")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Ігор"));

    expect(onChange).toHaveBeenCalledWith({
      contactId: CONTACT_IDS.ihor,
      kind: "picked",
      name: "Ігор",
    });
    expect(input).toHaveValue("Ігор");
  });

  it("offers no inline create for a name an existing contact already normalizes to", async () => {
    searchResults = [contactView()];
    const { input } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "  ІГОР ");

    expect(await screen.findByText("Ігор")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Створити «ІГОР»")).not.toBeInTheDocument());
  });

  it("opens the create dialog with the typed name already filled in", async () => {
    const { input } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");

    await userEvent.click(await screen.findByText("Створити «Марта»"));

    expect(await screen.findByLabelText(copy.name)).toHaveValue("Марта");
    expect(createCall()).toBeUndefined();
  });

  it("sends the contact detail typed in the dialog and selects the new contact", async () => {
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));

    await userEvent.type(await screen.findByLabelText(/^Контакт/), "marta@example.com");
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(String(createCall()?.[1].body))).toEqual({
      contact: "marta@example.com",
      name: "Марта",
    });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        contactId: CONTACT_IDS.marta,
        kind: "picked",
        name: "Марта",
      }),
    );
  });

  it("offers the existing contact when the name is already taken by a live one", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.duplicateName, message: "duplicate" }, 409);
    respondToLookup = () => jsonResponse(contactView({ id: CONTACT_IDS.marta, name: "Марта" }));
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(await screen.findByRole("button", { name: copy.submit }));

    expect(await screen.findByText("Контакт «Марта» вже існує")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Обрати Марта" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        contactId: CONTACT_IDS.marta,
        kind: "picked",
        name: "Марта",
      }),
    );
  });

  it("restores the archived contact that holds the typed name and selects it", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.archivedName, message: "archived" }, 409);
    respondToLookup = () =>
      jsonResponse(
        contactView({
          archivedAt: "2026-02-01T10:00:00.000Z",
          id: CONTACT_IDS.marta,
          name: "Марта",
        }),
      );
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(await screen.findByRole("button", { name: copy.submit }));

    expect(await screen.findByText("Контакт «Марта» є в архіві")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Відновити Марта" }));

    await waitFor(() => expect(restoreCall()).toBeDefined());
    expect(String(restoreCall()?.[0])).toContain(
      `/api/loans/contacts/${CONTACT_IDS.marta}/restore`,
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        contactId: CONTACT_IDS.marta,
        kind: "picked",
        name: "Марта",
      }),
    );
  });

  it("falls back to a field error when no contact holds the conflicting name", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.duplicateName, message: "duplicate" }, 409);
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");
    await userEvent.click(await screen.findByText("Створити «Марта»"));
    await userEvent.click(await screen.findByRole("button", { name: copy.submit }));

    expect(await screen.findByText(copy.errors.duplicateName)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
