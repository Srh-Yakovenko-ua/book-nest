import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { BarList, type BarListItem } from "./bar-list";

const genres: BarListItem[] = [
  { label: "Fantasy", value: 6 },
  { label: "Contemporary fiction", value: 4 },
  { label: "Romantasy", value: 3 },
  { label: "Historical fiction", value: 2 },
  { label: "Dark fantasy", value: 2 },
];

const meta = {
  title: "UI/BarList",
  component: BarList,
  tags: ["ai-generated"],
  args: {
    items: genres,
  },
  argTypes: {
    base: { control: "inline-radio", options: ["max", "sum"] },
    emphasizeLeader: { control: "boolean" },
    compact: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ranked: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Fantasy")).toBeVisible();
    await expect(canvas.getAllByRole("img")).toHaveLength(genres.length);
  },
};

export const Share: Story = {
  args: {
    base: "sum",
    items: genres.map((item, _index, all) => {
      const total = all.reduce((sum, entry) => sum + entry.value, 0);
      return { ...item, formattedValue: `${Math.round((item.value / total) * 100)}%` };
    }),
  },
};

export const EmphasizeLeader: Story = {
  args: { emphasizeLeader: true, items: genres.slice(0, 3) },
};

export const Compact: Story = {
  args: { compact: true, items: genres.slice(0, 4) },
};

export const Empty: Story = {
  args: { items: [], emptyLabel: "Add books to see stats" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Add books to see stats")).toBeVisible();
  },
};
