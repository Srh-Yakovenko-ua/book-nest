import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { LibraryTagFilter } from "./library-tag-filter";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

const TAGS = [
  { id: "tag-1", name: "slow burn" },
  { id: "tag-2", name: "dark academia" },
];

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  const names = new Map(TAGS.map((tag) => [tag.id, tag.name]));
  return (
    <div className="w-80">
      <LibraryTagFilter
        emptyLabel="Тегів не знайдено"
        id="library-filter-tag"
        label="Теги"
        onAdd={(tag) => setValue((prev) => [...prev, tag.id])}
        onRemove={(id) => setValue((prev) => prev.filter((item) => item !== id))}
        placeholder="Пошук тегів"
        removeLabel={(name) => `Прибрати тег ${name}`}
        resolveName={(id) => names.get(id)}
        searchingLabel="Пошук…"
        value={value}
      />
    </div>
  );
}

function mockTagsSearch(items: { id: string; name: string }[]) {
  globalThis.fetch = (() =>
    Promise.resolve(
      jsonResponse(200, { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length }),
    )) as typeof fetch;
}

const meta = {
  args: {
    emptyLabel: "Тегів не знайдено",
    id: "library-filter-tag",
    label: "Теги",
    onAdd: () => {},
    onRemove: () => {},
    placeholder: "Пошук тегів",
    removeLabel: (name: string) => `Прибрати тег ${name}`,
    resolveName: () => undefined,
    searchingLabel: "Пошук…",
    value: [],
  },
  component: LibraryTagFilter,
  tags: ["ai-generated"],
  title: "Books/LibraryTagFilter",
} satisfies Meta<typeof LibraryTagFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KeyboardSelect: Story = {
  play: async ({ canvas }) => {
    mockTagsSearch(TAGS);
    const input = canvas.getByRole("combobox", { name: "Теги" });
    await userEvent.click(input);
    await userEvent.type(input, "sl");
    const surface = within(document.body);
    await waitFor(() => expect(surface.getByText("slow burn")).toBeVisible());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByText("slow burn")).toBeVisible());
  },
  render: () => <Harness />,
};
