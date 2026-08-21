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

const CONTACT_IDS = {
  ihor: "11111111-1111-4111-8111-111111111111",
  marta: "22222222-2222-4222-8222-222222222222",
} as const;

const fetchMock = vi.fn();

let searchResults: LoanContactView[] = [];
let respondToCreate: () => Response;

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

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/loans/contacts") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
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
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/loans/contacts") && method === "POST") {
      return Promise.resolve(respondToCreate());
    }
    if (url.includes("/api/loans/contacts")) {
      return Promise.resolve(jsonResponse({ items: searchResults }));
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

  it("creates the typed contact and selects it right away", async () => {
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");

    await userEvent.click(await screen.findByText("Створити «Марта»"));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(String(createCall()?.[1].body))).toEqual({ name: "Марта" });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        contactId: CONTACT_IDS.marta,
        kind: "picked",
        name: "Марта",
      }),
    );
  });

  it("explains that an archived contact holds the typed name", async () => {
    respondToCreate = () =>
      jsonResponse({ code: LOAN_CONTACT_ERROR_CODES.archivedName, message: "archived" }, 409);
    const { input, onChange } = renderPicker();

    await userEvent.click(input);
    await userEvent.type(input, "Марта");

    await userEvent.click(await screen.findByText("Створити «Марта»"));

    expect(
      await screen.findByText(messages.loans.contactPicker.errors.archivedName),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
