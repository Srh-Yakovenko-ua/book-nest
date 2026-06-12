import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BarChart } from "./bar-chart";

const meta = {
  title: "UI/Charts/BarChart",
  component: BarChart,
  tags: ["ai-generated"],
  args: {
    ariaLabel: "Books per month",
    valueLabel: "Books",
    data: [
      { label: "Jan", fullLabel: "January", value: 2 },
      { label: "Feb", fullLabel: "February", value: 3 },
      { label: "Mar", fullLabel: "March", value: 4 },
      { label: "Apr", fullLabel: "April", value: 5 },
      { label: "May", fullLabel: "May", value: 3 },
      { label: "Jun", fullLabel: "June", value: 2 },
      { label: "Jul", fullLabel: "July", value: 6 },
      { label: "Aug", fullLabel: "August", value: 4 },
      { label: "Sep", fullLabel: "September", value: 3 },
      { label: "Oct", fullLabel: "October", value: 5 },
      { label: "Nov", fullLabel: "November", value: 4 },
      { label: "Dec", fullLabel: "December", value: 1 },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem] rounded-xl border border-border bg-card p-6 shadow-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SevenDays: Story = {
  args: {
    ariaLabel: "Pages over the last 7 days",
    valueLabel: "Pages",
    data: [
      { label: "Fri", fullLabel: "Friday", value: 12 },
      { label: "Sat", fullLabel: "Saturday", value: 35 },
      { label: "Sun", fullLabel: "Sunday", value: 22 },
      { label: "Mon", fullLabel: "Monday", value: 45 },
      { label: "Tue", fullLabel: "Tuesday", value: 28 },
      { label: "Wed", fullLabel: "Wednesday", value: 50 },
      { label: "Thu", fullLabel: "Thursday", value: 24 },
    ],
  },
};
