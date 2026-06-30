import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { type ActiveFilterChip, LibraryActiveFilters } from "./library-active-filters";

const LABELS: Record<string, string> = {
  "genre:fantasy": "Фентезі",
  q: "Пошук: крило",
  "status:finished": "Прочитано",
};

function Harness() {
  const [keys, setKeys] = useState(["q", "status:finished", "genre:fantasy"]);
  const chips: ActiveFilterChip[] = keys.map((key) => ({
    key,
    label: LABELS[key] ?? key,
    onRemove: () => setKeys((prev) => prev.filter((item) => item !== key)),
  }));
  return <LibraryActiveFilters chips={chips} onClearAll={() => setKeys([])} />;
}

const staticChips: ActiveFilterChip[] = Object.entries(LABELS).map(([key, label]) => ({
  key,
  label,
  onRemove: () => {},
}));

const meta = {
  args: { chips: staticChips, onClearAll: () => {} },
  component: LibraryActiveFilters,
  tags: ["ai-generated"],
  title: "Books/LibraryActiveFilters",
} satisfies Meta<typeof LibraryActiveFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Пошук: крило")).toBeVisible();
    await expect(canvas.getByText("Прочитано")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Очистити все" })).toBeVisible();
  },
};

export const RemoveOne: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Прибрати фільтр Прочитано" }));
    await waitFor(() => expect(canvas.queryByText("Прочитано")).toBeNull());
    await expect(canvas.getByText("Фентезі")).toBeVisible();
  },
  render: () => <Harness />,
};

export const ClearAll: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Очистити все" }));
    await waitFor(() => expect(canvas.queryByText("Пошук: крило")).toBeNull());
  },
  render: () => <Harness />,
};

export const Empty: Story = {
  args: { chips: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: "Очистити все" })).toBeNull();
  },
};
