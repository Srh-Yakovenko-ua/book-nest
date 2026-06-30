import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LineChart } from "./line-chart";

const months = [
  { label: "Jan", y2025: 320, y2024: 210 },
  { label: "Feb", y2025: 280, y2024: 260 },
  { label: "Mar", y2025: 410, y2024: 300 },
  { label: "Apr", y2025: 380, y2024: 340 },
  { label: "May", y2025: 520, y2024: 360 },
  { label: "Jun", y2025: 470, y2024: 430 },
  { label: "Jul", y2025: 610, y2024: 500 },
  { label: "Aug", y2025: 540, y2024: 470 },
];

const meta = {
  title: "UI/Charts/LineChart",
  component: LineChart,
  tags: ["ai-generated"],
  args: {
    ariaLabel: "Pages read in 2025",
    area: true,
    data: months,
    series: [{ key: "y2025", label: "2025" }],
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem] rounded-xl border border-border bg-card p-6 shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {};

export const MultiSeries: Story = {
  args: {
    ariaLabel: "Pages read 2024 vs 2025",
    area: false,
    series: [
      { key: "y2025", label: "2025" },
      { key: "y2024", label: "2024" },
    ],
  },
};
