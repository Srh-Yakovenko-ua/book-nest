import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons/ui-icon";

import { RingProgress } from "./ring-progress";

const meta = {
  title: "UI/RingProgress",
  component: RingProgress,
  tags: ["ai-generated"],
  args: {
    value: 45,
    max: 100,
    size: "md",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    tone: {
      control: "inline-radio",
      options: [undefined, "primary", "success", "warning", "error"],
    },
    indeterminate: { control: "boolean" },
  },
} satisfies Meta<typeof RingProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 45, label: "read" },
  play: async ({ canvas }) => {
    const ring = canvas.getByRole("progressbar");
    await expect(ring).toHaveAttribute("aria-valuenow", "45");
    await expect(ring).toHaveAttribute("aria-valuemin", "0");
    await expect(ring).toHaveAttribute("aria-valuemax", "100");
  },
};

export const Empty: Story = {
  args: { value: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  },
};

export const Complete: Story = {
  args: { value: 100 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-7">
      <RingProgress size="sm" value={60} />
      <RingProgress size="md" value={60} />
      <RingProgress label="goal" size="lg" value={60} />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex items-center gap-7">
      <RingProgress value={45} />
      <RingProgress value={100} />
      <RingProgress tone="warning" value={30} />
      <RingProgress tone="error" value={20} />
      <RingProgress aria-label="Loading" indeterminate />
    </div>
  ),
};

export const FractionValue: Story = {
  args: { max: 250, value: 180, size: "lg" },
  render: (args) => (
    <RingProgress {...args}>
      <span className="font-heading text-xl leading-none font-bold text-ink tabular-nums">
        180/250
      </span>
      <span className="text-[0.6875rem] font-medium text-muted-foreground">pages</span>
    </RingProgress>
  ),
  play: async ({ canvas }) => {
    const ring = canvas.getByRole("progressbar");
    await expect(ring).toHaveAttribute("aria-valuenow", "180");
    await expect(ring).toHaveAttribute("aria-valuemax", "250");
    await expect(ring).toHaveAttribute("aria-valuetext", "72%");
  },
};

export const CompleteIcon: Story = {
  render: () => (
    <RingProgress value={100}>
      <UiIcon className="text-success" name="check" size={34} />
    </RingProgress>
  ),
};
