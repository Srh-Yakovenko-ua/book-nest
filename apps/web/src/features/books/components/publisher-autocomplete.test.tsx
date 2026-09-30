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
let duplicateLookupFails = false;
let recent: PublisherView[] = [];
let searchResults: PublisherView[] = [];

function candidate({
  matchedName,
  matchKind,
  publisher,
}: {
  matchedName: PublisherDuplicateCandidate["matchedName"];
  matchKind: PublisherDuplicateCandidate["matchKind"];
  publisher: PublisherView;
}): PublisherDuplicateCandidate {
  return {
    id: publisher.id,
    isCustom: publisher.isCustom,
    matchedName,
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
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<null | PublisherSelection>(null);
  return (
    <>
      <PublisherAutocomplete
        invalid={false}
        label="Видавництво"
        onChange={setSelection}
        onQueryChange={setQuery}
        placeholder={PLACEHOLDER}
        query={query}
        value={selection}
      />
      <p data-testid="selection">{describeSelection(selection)}</p>
      <p data-testid="query">{`raw: ${query}`}</p>
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
  duplicateLookupFails = false;
  recent = [];
  searchResults = [];

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/publishers/duplicate-candidates")) {
      if (duplicateLookupFails) return Promise.resolve(new Response("boom", { status: 500 }));
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
    candidates = [
      candidate({ matchedName: VIVAT_SHORT.name, matchKind: "exact", publisher: VIVAT_SHORT }),
    ];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.queryByText(/Використати/)).not.toBeInTheDocument();
    expect(screen.queryByText("Додати власне")).not.toBeInTheDocument();
  });

  it("selects the publisher behind an alias by id instead of offering a custom one", async () => {
    candidates = [candidate({ matchedName: "Віват", matchKind: "alias", publisher: VIVAT_GLOBAL })];

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
    candidates = [candidate({ matchedName: null, matchKind: "strong", publisher: VIVAT_GLOBAL })];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByText("Схожі видавництва")).toBeInTheDocument();
    expect(screen.getByText("Усе одно додати «Vivat» як власне")).toBeInTheDocument();
    expect(screen.queryByText("Це видавництво вже є")).not.toBeInTheDocument();
  });

  it("explains which stored name an alias candidate matched", async () => {
    candidates = [candidate({ matchedName: "Віват", matchKind: "alias", publisher: VIVAT_GLOBAL })];

    renderWithProviders(<Harness />);
    await typeQuery("Віват");

    expect(await screen.findByText("також відоме як «Віват»")).toBeInTheDocument();
  });

  it("keeps an exact match on its own name unannotated", async () => {
    candidates = [
      candidate({ matchedName: VIVAT_GLOBAL.name, matchKind: "exact", publisher: VIVAT_GLOBAL }),
    ];

    renderWithProviders(<Harness />);
    await typeQuery("Видавництво Vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.queryByText(/також відоме як/)).not.toBeInTheDocument();
  });

  it("keeps a similar publisher without a matched name unannotated", async () => {
    candidates = [candidate({ matchedName: null, matchKind: "strong", publisher: VIVAT_GLOBAL })];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByText("Схожі видавництва")).toBeInTheDocument();
    expect(screen.queryByText(/також відоме як/)).not.toBeInTheDocument();
  });

  it("skips the hint when the matched name differs from the shown one only by case", async () => {
    candidates = [
      candidate({ matchedName: "видавництво vivat", matchKind: "alias", publisher: VIVAT_GLOBAL }),
    ];

    renderWithProviders(<Harness />);
    await typeQuery("видавництво vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.queryByText(/також відоме як/)).not.toBeInTheDocument();
  });

  it("reports the raw typed text to the owner without committing a selection", async () => {
    renderWithProviders(<Harness />);
    await typeQuery("Час");

    expect(screen.getByTestId("query")).toHaveTextContent("Час");
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("reports the picked publisher name as the raw text", async () => {
    candidates = [candidate({ matchedName: "Віват", matchKind: "alias", publisher: VIVAT_GLOBAL })];

    renderWithProviders(<Harness />);
    await typeQuery("Віват");

    await userEvent.click(await screen.findByText("Видавництво Vivat"));

    expect(screen.getByTestId("query")).toHaveTextContent("Видавництво Vivat");
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
    candidates = [
      candidate({ matchedName: VIVAT_GLOBAL.name, matchKind: "exact", publisher: VIVAT_GLOBAL }),
    ];
    recent = [VIVAT_GLOBAL];
    searchResults = [VIVAT_GLOBAL];

    renderWithProviders(<Harness />);
    await typeQuery("Видавництво Vivat");

    expect(await screen.findByText("Це видавництво вже є")).toBeInTheDocument();
    expect(screen.getAllByText("Видавництво Vivat")).toHaveLength(1);
    expect(screen.queryByText("Раніше використані")).not.toBeInTheDocument();
  });

  it("says the duplicate check failed and still offers the custom option", async () => {
    duplicateLookupFails = true;
    searchResults = [RANOK];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Не вдалося перевірити, чи таке видавництво вже є.",
    );
    expect(await screen.findByText("Ранок")).toBeInTheDocument();
    expect(screen.getByText("Використати «Vivat»")).toBeInTheDocument();
    expect(screen.queryByText("Видавництв не знайдено.")).not.toBeInTheDocument();
  });
});
