import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { LibraryQueryState } from "../model/library-query";

import { useLibraryQuery } from "../model/use-library-query";
import { LibraryAdvancedFilters } from "./library-advanced-filters";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/genres")) return Promise.resolve(jsonResponse(200, []));
  return Promise.resolve(
    jsonResponse(200, { items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 }),
  );
}) as typeof fetch;

function countActive(state: LibraryQueryState): number {
  let count =
    state.status.length +
    state.owner.length +
    state.format.length +
    state.genre.length +
    state.tag.length +
    state.ageCategory.length +
    state.language.length +
    state.author.length +
    state.publisher.length;
  if (state.bookType !== null) count += 1;
  if (state.isFavorite !== null) count += 1;
  if (state.hasCover !== null) count += 1;
  if (state.ratingMin !== null || state.ratingMax !== null) count += 1;
  if (state.yearMin !== null || state.yearMax !== null) count += 1;
  if (state.pagesMin !== null || state.pagesMax !== null) count += 1;
  return count;
}

function Harness() {
  const library = useLibraryQuery();
  return (
    <LibraryAdvancedFilters
      activeCount={countActive(library.state)}
      onClearFilters={library.clearFilters}
      onRememberEntity={() => {}}
      resolveEntityName={() => undefined}
      setState={library.setState}
      state={library.state}
    />
  );
}

function renderWithParams(searchParams?: string) {
  return (
    <NuqsTestingAdapter searchParams={searchParams}>
      <Harness />
    </NuqsTestingAdapter>
  );
}

const DEFAULT_STATE: LibraryQueryState = {
  ageCategory: [],
  author: [],
  bookType: null,
  format: [],
  genre: [],
  hasCover: null,
  isFavorite: null,
  language: [],
  owner: [],
  pagesMax: null,
  pagesMin: null,
  publisher: [],
  q: "",
  ratingMax: null,
  ratingMin: null,
  sort: "created_desc",
  status: [],
  tag: [],
  view: "grid",
  yearMax: null,
  yearMin: null,
};

const meta = {
  args: {
    activeCount: 0,
    onClearFilters: () => {},
    onRememberEntity: () => {},
    resolveEntityName: () => undefined,
    setState: async () => new URLSearchParams(),
    state: DEFAULT_STATE,
  },
  component: LibraryAdvancedFilters,
  tags: ["ai-generated"],
  title: "Books/LibraryAdvancedFilters",
} satisfies Meta<typeof LibraryAdvancedFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Фільтри/ }));
    const surface = within(document.body);
    await waitFor(() => expect(surface.getByText("Статус читання")).toBeVisible());
    await expect(surface.getByText("Формат книги")).toBeVisible();
    await expect(surface.getByText("Рік видання")).toBeVisible();
  },
  render: () => renderWithParams(),
};

export const WithActiveFilters: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Фільтри/ })).toHaveTextContent("2");
    await userEvent.click(canvas.getByRole("button", { name: /Фільтри/ }));
    const surface = within(document.body);
    await waitFor(() =>
      expect(surface.getByRole("button", { name: "Прочитано" })).toHaveAttribute(
        "data-state",
        "on",
      ),
    );
    await expect(surface.getByRole("button", { name: "Паперова" })).toHaveAttribute(
      "data-state",
      "on",
    );
  },
  render: () => renderWithParams("?status=finished&format=paper"),
};

export const ClearInsideSheet: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Фільтри/ }));
    const surface = within(document.body);
    await waitFor(() =>
      expect(surface.getByRole("button", { name: "Прочитано" })).toHaveAttribute(
        "data-state",
        "on",
      ),
    );
    await userEvent.click(surface.getByRole("button", { name: "Очистити фільтри" }));
    await waitFor(() =>
      expect(surface.getByRole("button", { name: "Прочитано" })).toHaveAttribute(
        "data-state",
        "off",
      ),
    );
  },
  render: () => renderWithParams("?status=finished"),
};
