import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { Rating } from "./rating";

const meta = {
  args: {
    value: 4.5,
  },
  component: Rating,
  tags: ["ai-generated"],
  title: "UI/Rating",
} satisfies Meta<typeof Rating>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: /4.5 з 10/ })).toBeVisible();
  },
};

export const Fractional: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {[5, 4.5, 4.2, 3, 1.5, 0].map((value) => (
        <div className="flex items-center gap-3 text-foreground" key={value}>
          <span className="w-10 text-sm text-muted-foreground tabular-nums">{value}</span>
          <Rating value={value} />
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <Rating size="sm" value={4} />
      <Rating size="md" value={4} />
      <Rating size="lg" value={4} />
    </div>
  ),
};

function InteractiveExample() {
  const [value, setValue] = useState(0);

  return (
    <div className="flex items-center gap-4 text-foreground">
      <Rating onValueChange={setValue} size="lg" value={value} />
      <span className="min-w-14 text-sm font-semibold tabular-nums">
        {value ? `${value.toFixed(1)} / 10` : "—"}
      </span>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveExample />,
  play: async ({ canvas }) => {
    const slider = canvas.getByRole("slider");
    slider.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect(slider).toHaveAttribute("aria-valuenow", "1.5");
  },
};
