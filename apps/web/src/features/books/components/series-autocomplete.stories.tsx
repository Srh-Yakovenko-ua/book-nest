import type { SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { type AuthorSelection, type SeriesSelection } from "../model/create-book-form";
import { SeriesAutocomplete } from "./series-autocomplete";

type SeriesSeed = {
  authors?: { id: string; name: string }[];
  id: string;
  name: string;
  status?: SeriesView["status"];
  totalBooks?: number;
};

const PLACEHOLDER = "Почніть вводити назву серії…";

function describeSelection(value: null | SeriesSelection) {
  if (value === null) return "none";
  if (value.kind === "existing") return `existing:${value.name}:${value.authorIds.join(",")}`;
  return `new:${value.name}`;
}

function Harness({ authorSelections = [] }: { authorSelections?: AuthorSelection[] }) {
  const [value, setValue] = useState<null | SeriesSelection>(null);
  return (
    <div className="w-96">
      <label className="sr-only" htmlFor="series">
        Серія
      </label>
      <SeriesAutocomplete
        authorSelections={authorSelections}
        id="series"
        invalid={false}
        label="Серія"
        onChange={setValue}
        onCreateRequest={() => undefined}
        placeholder={PLACEHOLDER}
        value={value}
      />
      <p data-testid="selection">{describeSelection(value)}</p>
    </div>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockSeries({ all = [], scoped = [] }: { all?: SeriesSeed[]; scoped?: SeriesSeed[] }) {
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    const items = url.includes("authorIds") ? scoped : all;
    return Promise.resolve(seriesPage(items.map(seriesView)));
  }) as typeof fetch;
}

function seriesPage(items: SeriesView[]): Response {
  return jsonResponse(200, {
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
  });
}

function seriesView(seed: SeriesSeed): SeriesView {
  return {
    authors: seed.authors ?? [],
    booksInSeries: 0,
    description: null,
    finishedInSeries: 0,
    id: seed.id,
    name: seed.name,
    status: seed.status ?? "ongoing",
    totalBooks: seed.totalBooks ?? null,
  };
}

const meta = {
  args: {
    authorSelections: [],
    id: "series",
    invalid: false,
    label: "Серія",
    onChange: () => undefined,
    onCreateRequest: () => undefined,
    placeholder: PLACEHOLDER,
    value: null,
  },
  beforeEach: () => {
    mockSeries({});
  },
  component: SeriesAutocomplete,
  tags: ["ai-generated"],
  title: "Books/SeriesAutocomplete",
} satisfies Meta<typeof SeriesAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAPKOWSKI: AuthorSelection = { id: "author-1", kind: "catalog", name: "Сапковський" };

export const AuthorScopedGroups: Story = {
  beforeEach: () => {
    mockSeries({
      scoped: [
        { authors: [{ id: "author-1", name: "Сапковський" }], id: "s1", name: "Відьмак" },
        { id: "s2", name: "Безіменна сага" },
      ],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText(PLACEHOLDER);
    await userEvent.click(input);

    await expect(await surface.findByText("Серії автора Сапковський")).toBeInTheDocument();
    await expect(surface.getByText("Серії без автора")).toBeInTheDocument();
    await expect(surface.getByText("Відьмак")).toBeInTheDocument();
    await expect(surface.getByText("Безіменна сага")).toBeInTheDocument();
  },
  render: () => <Harness authorSelections={[SAPKOWSKI]} />,
};

export const NoAuthorFlatList: Story = {
  beforeEach: () => {
    mockSeries({
      all: [
        { authors: [{ id: "author-1", name: "Сапковський" }], id: "s1", name: "Відьмак" },
        { id: "s2", name: "Дюна" },
      ],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText(PLACEHOLDER);
    await userEvent.click(input);

    await expect(await surface.findByText("Ваші серії")).toBeInTheDocument();
    await expect(surface.queryByText("Серії автора Сапковський")).toBeNull();
    await expect(surface.getByText("Відьмак")).toBeInTheDocument();
    await expect(surface.getByText("Сапковський")).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const PickCapturesSeriesAuthors: Story = {
  beforeEach: () => {
    mockSeries({
      scoped: [{ authors: [{ id: "author-1", name: "Сапковський" }], id: "s1", name: "Відьмак" }],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText(PLACEHOLDER);
    await userEvent.click(input);

    await userEvent.click(await surface.findByText("Відьмак"));

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("existing:Відьмак:author-1"),
    );
  },
  render: () => <Harness authorSelections={[SAPKOWSKI]} />,
};
