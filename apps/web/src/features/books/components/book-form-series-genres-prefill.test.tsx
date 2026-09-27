import "@testing-library/jest-dom/vitest";

import type { GenreView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { BookFormInitialSeries } from "../model/create-book-form";

import { BookForm } from "./book-form";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const DRAFT_KEY = "book-form-draft:create";

const GENRE_NAMES = {
  detective: "Детектив",
  fantasy: "Фентезі",
  historical: "Історичний",
  horror: "Жахи",
  poetry: "Поезія",
  romance: "Романтика",
} as const;

const GENRE_CATALOG: GenreView[] = Object.entries(GENRE_NAMES).map(([key, name]) => ({
  groupKey: "fiction",
  groupName: "Художня література",
  id: `genre-${key}`,
  isDefault: true,
  key,
  name,
}));

function genresField(): HTMLElement {
  const field = genresTrigger().closest("div");
  if (field === null) throw new Error("genres field wrapper is missing");
  return field;
}

function genresTrigger(): HTMLElement {
  return screen.getByLabelText("Жанри");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function mockApi() {
  fetchMock.mockImplementation((input) => {
    const path = String(input);
    if (path.includes("/api/genres/recent")) return Promise.resolve(jsonResponse([]));
    if (path.includes("/api/genres")) return Promise.resolve(jsonResponse(GENRE_CATALOG));
    if (path.includes("/api/publishers/recent")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(page([]));
  });
}

function page(items: unknown[]): Response {
  return jsonResponse({
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
  });
}

function selectedGenreNames(): string[] {
  return within(genresField())
    .queryAllByRole("button", { name: /^Прибрати / })
    .map((chip) => chip.getAttribute("aria-label")?.replace("Прибрати ", "") ?? "");
}

function storeDraftWithGenres(genres: string[]) {
  sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      authorSelections: [],
      loanContactSelection: null,
      locale: "en",
      publisherEdited: false,
      publisherSelection: null,
      seriesSelection: null,
      values: { genres },
    }),
  );
}

function witcher(genres: string[]): BookFormInitialSeries {
  return {
    partNumber: 2,
    selection: {
      authors: [],
      commonGenres: [],
      dominantPublisher: null,
      genres,
      id: "series-witcher",
      kind: "existing",
      name: "Відьмак",
    },
  };
}

vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  mockApi();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BookForm series genres prefill", () => {
  it("prefills the genres of the series the book is created from", async () => {
    renderWithProviders(<BookForm initialSeries={witcher(["fantasy", "romance"])} mode="create" />);

    await waitFor(() => expect(selectedGenreNames()).toEqual(["Фентезі", "Романтика"]));
  });

  it("names the series the prefilled genres came from", async () => {
    renderWithProviders(<BookForm initialSeries={witcher(["fantasy"])} mode="create" />);

    expect(await screen.findByText("Жанри підставлені з серії «Відьмак»")).toBeInTheDocument();
  });

  it("prefills nothing when the series has no genres", async () => {
    renderWithProviders(<BookForm initialSeries={witcher([])} mode="create" />);

    await waitFor(() => expect(genresTrigger()).toBeEnabled());
    expect(selectedGenreNames()).toEqual([]);
    expect(screen.queryByText(/підставлені з серії/)).not.toBeInTheDocument();
  });

  it("prefills nothing when the form is opened without a series", async () => {
    renderWithProviders(<BookForm mode="create" />);

    await waitFor(() => expect(genresTrigger()).toBeEnabled());
    expect(selectedGenreNames()).toEqual([]);
    expect(screen.queryByText(/підставлені з серії/)).not.toBeInTheDocument();
  });

  it("keeps only the first five genres when the series carries more", async () => {
    renderWithProviders(
      <BookForm
        initialSeries={witcher([
          "fantasy",
          "romance",
          "detective",
          "historical",
          "horror",
          "poetry",
        ])}
        mode="create"
      />,
    );

    await waitFor(() =>
      expect(selectedGenreNames()).toEqual([
        "Фентезі",
        "Романтика",
        "Детектив",
        "Історичний",
        "Жахи",
      ]),
    );
    expect(within(genresField()).queryByText("Поезія")).not.toBeInTheDocument();
  });

  it("drops the prefilled genres when the book stops being part of the series", async () => {
    renderWithProviders(<BookForm initialSeries={witcher(["fantasy", "romance"])} mode="create" />);
    await waitFor(() => expect(selectedGenreNames()).toEqual(["Фентезі", "Романтика"]));

    await userEvent.click(screen.getByRole("radio", { name: "Окрема книга" }));

    await waitFor(() => expect(selectedGenreNames()).toEqual([]));
    expect(screen.queryByText(/підставлені з серії/)).not.toBeInTheDocument();
  });

  it("keeps the genres the user cleared before switching the interface language empty", async () => {
    storeDraftWithGenres([]);
    renderWithProviders(<BookForm initialSeries={witcher(["fantasy"])} mode="create" />);

    await waitFor(() => expect(genresTrigger()).toBeEnabled());
    expect(selectedGenreNames()).toEqual([]);
    expect(screen.queryByText(/підставлені з серії/)).not.toBeInTheDocument();
  });
});
