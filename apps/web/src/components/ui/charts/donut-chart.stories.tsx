import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { DonutChart } from "./donut-chart";

const meta = {
  title: "UI/Charts/DonutChart",
  component: DonutChart,
  tags: ["ai-generated"],
  args: {
    ariaLabel: "Book formats",
    centerLabel: "Total",
    centerCaption: "books",
    data: [
      { label: "Paperback", value: 18 },
      { label: "Ebook", value: 11 },
      { label: "Audiobook", value: 3 },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[34rem] rounded-xl border border-border bg-card p-6 shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DonutChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Paperback")).toBeVisible();
    await expect(canvas.getByText("18 (56%)")).toBeVisible();
  },
};

export const FourSlices: Story = {
  args: {
    ariaLabel: "Reading status",
    centerLabel: "All",
    data: [
      { label: "Read", value: 32 },
      { label: "Want to read", value: 12 },
      { label: "On hold", value: 4 },
      { label: "Reading now", value: 3 },
    ],
  },
};
