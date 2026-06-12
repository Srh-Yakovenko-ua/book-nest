import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { EMPTY_STATE_ORDER, EMPTY_STATES } from "@/lib/empty-states";

import { EmptyState } from "./empty-state";

const meta = {
  args: {
    stateKey: "library",
  },
  argTypes: {
    stateKey: {
      control: "select",
      options: Object.keys(EMPTY_STATES),
    },
  },
  component: EmptyState,
  tags: ["ai-generated"],
  title: "Patterns/EmptyState",
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Library: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("heading", { name: EMPTY_STATES.library.title })).toBeVisible();
    const image = canvasElement.querySelector("img");
    await expect(image?.getAttribute("src")).toContain("empty-library");

    const fonts = canvasElement.ownerDocument.fonts;
    await fonts.ready;
    const loadedFamilies = new Set(
      [...fonts].filter((font) => font.status === "loaded").map((font) => font.family),
    );
    await expect(loadedFamilies.has("Playfair Display Variable")).toBe(true);
    await expect(loadedFamilies.has("Manrope Variable")).toBe(true);
    await expect(fonts.check('16px "Playfair Display Variable"')).toBe(true);
    await expect(fonts.check('16px "Manrope Variable"')).toBe(true);

    const heading = canvas.getByRole("heading", { name: EMPTY_STATES.library.title });
    const description = canvas.getByText(EMPTY_STATES.library.desc);
    const view = canvasElement.ownerDocument.defaultView;
    await expect(view?.getComputedStyle(heading).fontFamily).toContain("Playfair Display");
    await expect(view?.getComputedStyle(description).fontFamily).toContain("Manrope");
  },
};

export const Purchases: Story = {
  args: { stateKey: "purchases" },
};

export const Lists: Story = {
  args: { stateKey: "lists" },
};

export const Search: Story = {
  args: { stateKey: "search" },
};

export const GenericError: Story = {
  args: { stateKey: "error_generic" },
};

export const FromEntry: Story = {
  args: { state: EMPTY_STATES.favorites },
};

export const Gallery: Story = {
  play: async ({ canvasElement }) => {
    const origin = canvasElement.ownerDocument.location.origin;
    const urls = [...new Set(Object.values(EMPTY_STATES).map((entry) => entry.illu))].map(
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
      {EMPTY_STATE_ORDER.map((key) => (
        <div className="rounded-xl border border-border" key={key}>
          <EmptyState stateKey={key} />
        </div>
      ))}
    </div>
  ),
};
