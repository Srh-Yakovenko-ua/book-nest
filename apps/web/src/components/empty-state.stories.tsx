import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import type { EmptyStateEntry } from "@/lib/empty-states";

import messages from "@/messages/uk.json";

import { EmptyState } from "./empty-state";

const library = messages.books.library;
const lists = messages.lists.catalog;

const ENTRIES = {
  favorites: {
    desc: messages.favorites.empty.description,
    illu: "empty-favorites",
    primary: { icon: "book", label: messages.favorites.empty.cta },
    title: messages.favorites.empty.title,
  },
  genericError: {
    desc: library.error.description,
    illu: "error-generic",
    primary: { icon: "refresh", label: library.error.retry },
    title: library.error.title,
  },
  library: {
    desc: library.empty.my.description,
    illu: "empty-library",
    illuSize: "lg",
    primary: { icon: "plus", label: library.empty.my.cta },
    secondary: { icon: "book", label: library.empty.my.secondary },
    title: library.empty.my.title,
  },
  lists: {
    desc: lists.empty.description,
    illu: "empty-lists",
    primary: { icon: "plus", label: lists.empty.create },
    secondary: { icon: "book", label: lists.empty.secondary },
    title: lists.empty.title,
  },
  purchases: {
    desc: messages.booksToBuy.empty.description,
    illu: "empty-purchases",
    primary: { icon: "plus", label: messages.booksToBuy.empty.cta },
    secondary: { icon: "book", label: messages.booksToBuy.empty.secondary },
    title: messages.booksToBuy.empty.title,
  },
  search: {
    desc: lists.noResults.description,
    illu: "empty-search",
    primary: { icon: "x", label: lists.noResults.clear },
    title: lists.noResults.title,
  },
} as const satisfies Record<string, EmptyStateEntry>;

const meta = {
  args: {
    state: ENTRIES.library,
  },
  component: EmptyState,
  tags: ["ai-generated"],
  title: "Patterns/EmptyState",
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Library: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { name: ENTRIES.library.title })).toBeVisible();
    const image = canvasElement.querySelector("img");
    await expect(image?.getAttribute("src")).toContain("empty-library");
    await expect(image?.getAttribute("loading")).toBe("eager");

    const fonts = canvasElement.ownerDocument.fonts;
    await fonts.ready;
    const loadedFamilies = new Set(
      [...fonts].filter((font) => font.status === "loaded").map((font) => font.family),
    );
    await expect(loadedFamilies.has("Playfair Display Variable")).toBe(true);
    await expect(loadedFamilies.has("Manrope Variable")).toBe(true);
    await expect(fonts.check('16px "Playfair Display Variable"')).toBe(true);
    await expect(fonts.check('16px "Manrope Variable"')).toBe(true);

    const heading = canvas.getByRole("heading", { name: ENTRIES.library.title });
    const description = canvas.getByText(ENTRIES.library.desc);
    const view = canvasElement.ownerDocument.defaultView;
    await expect(view?.getComputedStyle(heading).fontFamily).toContain("Playfair Display");
    await expect(view?.getComputedStyle(description).fontFamily).toContain("Manrope");
  },
};

export const Purchases: Story = {
  args: { state: ENTRIES.purchases },
};

export const Lists: Story = {
  args: { state: ENTRIES.lists },
};

export const Search: Story = {
  args: { state: ENTRIES.search },
};

export const GenericError: Story = {
  args: { state: ENTRIES.genericError },
};

export const Favorites: Story = {
  args: { state: ENTRIES.favorites },
};

export const Gallery: Story = {
  play: async ({ canvasElement }) => {
    const origin = canvasElement.ownerDocument.location.origin;
    const urls = [...new Set(Object.values(ENTRIES).map((entry) => entry.illu))].map(
      (illu) => `${origin}/illustrations/${illu}.png`,
    );

    const results = await Promise.all(
      urls.map(async (url) => ({ ok: (await fetch(url)).ok, url })),
    );
    const failing = results.filter((result) => !result.ok).map((result) => result.url);
    await expect(failing).toEqual([]);
  },
  render: () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Object.entries(ENTRIES).map(([key, entry]) => (
        <div className="rounded-xl border border-border" key={key}>
          <EmptyState state={entry} />
        </div>
      ))}
    </div>
  ),
};
