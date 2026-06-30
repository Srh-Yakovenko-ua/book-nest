import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { type LibraryQuickFilterKey } from "../model/library-quick-filters";
import { LibraryQuickFilters } from "./library-quick-filters";

function Harness({ initial = "all" }: { initial?: LibraryQuickFilterKey | null }) {
  const [value, setValue] = useState<LibraryQuickFilterKey | null>(initial);
  return (
    <div className="max-w-2xl">
      <LibraryQuickFilters onSelect={setValue} value={value} />
    </div>
  );
}

const meta = {
  args: { onSelect: () => {}, value: "all" },
  component: LibraryQuickFilters,
  tags: ["ai-generated"],
  title: "Books/LibraryQuickFilters",
} satisfies Meta<typeof LibraryQuickFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Усі" })).toHaveAttribute("data-state", "on");
    await expect(canvas.getByRole("radio", { name: "Читаю" })).toHaveAttribute("data-state", "off");
  },
  render: () => <Harness />,
};

export const ReadingActive: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Читаю" })).toHaveAttribute("data-state", "on");
    await expect(canvas.getByRole("radio", { name: "Усі" })).toHaveAttribute("data-state", "off");
  },
  render: () => <Harness initial="reading" />,
};

export const Selecting: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Улюблені" }));
    await waitFor(() =>
      expect(canvas.getByRole("radio", { name: "Улюблені" })).toHaveAttribute("data-state", "on"),
    );
    await expect(canvas.getByRole("radio", { name: "Усі" })).toHaveAttribute("data-state", "off");
  },
  render: () => <Harness />,
};

export const CustomState: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Усі" })).toHaveAttribute("data-state", "off");
  },
  render: () => <Harness initial={null} />,
};
