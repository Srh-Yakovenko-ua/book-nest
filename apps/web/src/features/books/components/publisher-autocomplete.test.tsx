import "@testing-library/jest-dom/vitest";

import type { PublisherDuplicateCandidate, PublisherView } from "@app/shared";

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { PublisherSelection } from "../model/create-book-form";

import { PublisherAutocomplete } from "./publisher-autocomplete";

const PLACEHOLDER = "Почніть вводити назву видавництва…";

const VIVAT_SHORT: PublisherView = publisherView("publisher-vivat-custom", "Vivat");
const VIVAT_GLOBAL: PublisherView = publisherView("publisher-vivat", "Видавництво Vivat");
const RANOK: PublisherView = publisherView("publisher-ranok", "Ранок");

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let candidates: PublisherDuplicateCandidate[] = [];
let recent: PublisherView[] = [];
let searchResults: PublisherView[] = [];

function candidate(
  publisher: PublisherView,
  matchKind: PublisherDuplicateCandidate["matchKind"],
): PublisherDuplicateCandidate {
  return {
    id: publisher.id,
    isCustom: publisher.isCustom,
    matchKind,
    name: publisher.name,
  };
}

function describeSelection(selection: null | PublisherSelection): string {
  if (selection === null) return "none";
  if (selection.kind === "custom") return `custom:${selection.name}`;
  return `catalog:${selection.id}:${selection.name}`;
}

function Harness() {
  const [selection, setSelection] = useState<null | PublisherSelection>(null);
  return (
    <>
      <PublisherAutocomplete
        id="publisher"
        invalid={false}
        label="Видавництво"
        onChange={setSelection}
        placeholder={PLACEHOLDER}
        value={selection}
      />
      <p data-testid="selection">{describeSelection(selection)}</p>
    </>
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function publisherView(id: string, name: string): PublisherView {
  return {
    countryCode: null,
    foundedYear: null,
    id,
    isCustom: false,
    logoAttribution: null,
    logoLicense: null,
    logoLicenseUrl: null,
    logoUrl: null,
    name,
    websiteUrl: null,
  };
}

async function typeQuery(text: string) {
  const input = screen.getByPlaceholderText(PLACEHOLDER);
  await userEvent.click(input);
  await userEvent.type(input, text);
}

beforeEach(() => {
  candidates = [];
  recent = [];
  searchResults = [];

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/publishers/duplicate-candidates")) {
      return Promise.resolve(jsonResponse(candidates));
    }
    if (url.includes("/api/publishers/recent")) return Promise.resolve(jsonResponse(recent));
    return Promise.resolve(
      jsonResponse({
        items: searchResults,
        page: 1,
        pagesCount: 1,
        pageSize: 20,
        totalCount: searchResults.length,
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublisherAutocomplete duplicate candidates", () => {
  it("hides the create-custom option when the name is already an existing publisher", async () => {
    candidates = [candidate(VIVAT_SHORT, "exact")];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.queryByText(/Використати/)).not.toBeInTheDocument();
    expect(screen.queryByText("Додати власне")).not.toBeInTheDocument();
  });

  it("selects the publisher behind an alias by id instead of offering a custom one", async () => {
    candidates = [candidate(VIVAT_GLOBAL, "alias")];

    renderWithProviders(<Harness />);
    await typeQuery("Віват");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.queryByText(/Використати/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Видавництво Vivat"));

    expect(screen.getByTestId("selection")).toHaveTextContent(
      "catalog:publisher-vivat:Видавництво Vivat",
    );
  });

  it("keeps the create-custom option as a secondary action next to similar publishers", async () => {
    candidates = [candidate(VIVAT_GLOBAL, "strong")];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByText("Схожі видавництва")).toBeInTheDocument();
    expect(screen.getByText("Усе одно додати «Vivat» як власне")).toBeInTheDocument();
    expect(screen.queryByText("Це видавництво вже є")).not.toBeInTheDocument();
  });

  it("renders a publisher returned by both recent and search only once", async () => {
    recent = [RANOK];
    searchResults = [RANOK, VIVAT_GLOBAL];

    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByPlaceholderText(PLACEHOLDER));

    expect(await screen.findByText("Раніше використані")).toBeInTheDocument();
    expect(await screen.findByText("Видавництво Vivat")).toBeInTheDocument();
    expect(screen.getAllByText("Ранок")).toHaveLength(1);
  });

  it("renders a matched publisher once even when recent and search repeat it", async () => {
    candidates = [candidate(VIVAT_GLOBAL, "exact")];
    recent = [VIVAT_GLOBAL];
    searchResults = [VIVAT_GLOBAL];

    renderWithProviders(<Harness />);
    await typeQuery("Видавництво Vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.getAllByText("Видавництво Vivat")).toHaveLength(1);
    expect(screen.queryByText("Раніше використані")).not.toBeInTheDocument();
  });
});
