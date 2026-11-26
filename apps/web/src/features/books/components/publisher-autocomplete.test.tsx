import "@testing-library/jest-dom/vitest";

import type { PublisherDuplicateCandidate, PublisherView } from "@app/shared";

import { onlineManager } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { PublisherSelection } from "../model/create-book-form";

import { PublisherAutocomplete } from "./publisher-autocomplete";

const PLACEHOLDER = "Почніть вводити назву видавництва…";
const publisherCopy = messages.books.publisher;

const VIVAT_SHORT: PublisherView = publisherView("publisher-vivat-custom", "Vivat");
const VIVAT_GLOBAL: PublisherView = publisherView("publisher-vivat", "Видавництво Vivat");
const RANOK: PublisherView = publisherView("publisher-ranok", "Ранок");

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
const heldLookups = new Map<string, HeldLookup>();

let candidates: PublisherDuplicateCandidate[] = [];
let duplicateLookupFails = false;
let recent: PublisherView[] = [];
let searchResults: PublisherView[] = [];

type HeldLookup = {
  answer: Promise<PublisherDuplicateCandidate[]>;
  markSent: () => void;
};

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

function holdLookup(name: string) {
  let markSent = () => {};
  let release: (answer: PublisherDuplicateCandidate[]) => void = () => {};
  const sent = new Promise<void>((resolve) => {
    markSent = () => resolve();
  });
  const answer = new Promise<PublisherDuplicateCandidate[]>((resolve) => {
    release = resolve;
  });
  heldLookups.set(name, { answer, markSent });
  return { release, sent };
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
  heldLookups.clear();

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/publishers/duplicate-candidates")) {
      if (duplicateLookupFails) return Promise.resolve(new Response("boom", { status: 500 }));
      const lookupName = new URL(url, "http://localhost").searchParams.get("name") ?? "";
      const held = heldLookups.get(lookupName);
      if (held === undefined) return Promise.resolve(jsonResponse(candidates));
      held.markSent();
      return held.answer.then(jsonResponse);
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

describe("PublisherAutocomplete lookup of a changed name", () => {
  it("offers neither the previous name's match nor the custom option until the new name is checked", async () => {
    candidates = [
      candidate({ matchedName: VIVAT_SHORT.name, matchKind: "exact", publisher: VIVAT_SHORT }),
    ];
    const folioLookup = holdLookup("Folio");

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");
    const existing = await screen.findByRole("group", { name: publisherCopy.existingHeading });
    expect(within(existing).getByRole("option", { name: "Vivat" })).toBeInTheDocument();

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.clear(input);
    await userEvent.type(input, "Folio");
    await folioLookup.sent;

    expect(screen.queryByRole("option", { name: "Vivat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Folio/ })).not.toBeInTheDocument();

    folioLookup.release([]);

    expect(
      await screen.findByRole("option", {
        name: publisherCopy.useCustom.replace("{name}", "Folio"),
      }),
    ).toBeInTheDocument();
  });

  it.each([
    { edit: "{Backspace}".repeat(5), field: "cleared" },
    { edit: "{Backspace}".repeat(4), field: "cut to one character" },
  ])("stops listing the previous name's match once the field is $field", async ({ edit }) => {
    candidates = [
      candidate({ matchedName: VIVAT_SHORT.name, matchKind: "exact", publisher: VIVAT_SHORT }),
    ];

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");
    const existing = await screen.findByRole("group", { name: publisherCopy.existingHeading });
    expect(within(existing).getByRole("option", { name: "Vivat" })).toBeInTheDocument();

    searchResults = [RANOK];
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), edit);

    expect(await screen.findByRole("option", { name: "Ранок" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Vivat" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: publisherCopy.existingHeading }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: publisherCopy.similarHeading }),
    ).not.toBeInTheDocument();
  });

  it("says it is still searching while the typed name is checked and nothing else is listed", async () => {
    searchResults = [RANOK];
    const folioLookup = holdLookup("Folio");

    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByPlaceholderText(PLACEHOLDER));
    expect(await screen.findByRole("option", { name: "Ранок" })).toBeInTheDocument();

    searchResults = [];
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Folio");
    await folioLookup.sent;
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Ранок" })).not.toBeInTheDocument(),
    );

    expect(await screen.findByText(publisherCopy.searching)).toBeInTheDocument();
    expect(screen.queryByText(publisherCopy.empty)).not.toBeInTheDocument();

    folioLookup.release([]);

    expect(
      await screen.findByRole("option", {
        name: publisherCopy.useCustom.replace("{name}", "Folio"),
      }),
    ).toBeInTheDocument();
  });

  it("says the new name cannot be checked and offers it as custom while the browser is offline", async () => {
    candidates = [
      candidate({ matchedName: VIVAT_SHORT.name, matchKind: "exact", publisher: VIVAT_SHORT }),
    ];
    const sentLookupNames = () =>
      fetchMock.mock.calls
        .map(([input]) => new URL(String(input), "http://localhost"))
        .filter((url) => url.pathname === "/api/publishers/duplicate-candidates")
        .map((url) => url.searchParams.get("name"));

    renderWithProviders(<Harness />);
    await typeQuery("Vivat");
    const existing = await screen.findByRole("group", { name: publisherCopy.existingHeading });
    expect(within(existing).getByRole("option", { name: "Vivat" })).toBeInTheDocument();

    candidates = [];
    onlineManager.setOnline(false);
    try {
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      await userEvent.clear(input);
      await userEvent.type(input, "Folio");

      expect(await screen.findByRole("status")).toHaveTextContent(publisherCopy.lookupUnavailable);
      expect(
        await screen.findByRole("option", {
          name: publisherCopy.useCustom.replace("{name}", "Folio"),
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Vivat" })).not.toBeInTheDocument();
      expect(screen.queryByText(publisherCopy.searching)).not.toBeInTheDocument();
      expect(sentLookupNames()).not.toContain("Folio");
    } finally {
      onlineManager.setOnline(true);
      await waitFor(() => expect(sentLookupNames()).toContain("Folio"));
    }
  });
});
