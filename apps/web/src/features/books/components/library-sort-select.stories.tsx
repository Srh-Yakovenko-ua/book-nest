import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import type { LibrarySortOption } from "./library-sort-select";

import { LibrarySortSelect } from "./library-sort-select";

const options: LibrarySortOption[] = [
  { label: "Нещодавно додані", value: "created_desc" },
  { label: "Давно додані", value: "created_asc" },
  { label: "Назва А–Я", value: "title_asc" },
  { label: "Найвищий рейтинг", value: "rating_desc" },
];

const meta = {
  args: { label: "Сортування", onChange: () => {}, options, value: "created_desc" },
  component: LibrarySortSelect,
  tags: ["ai-generated"],
  title: "Books/LibrarySortSelect",
} satisfies Meta<typeof LibrarySortSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox", { name: "Сортування" });
    await waitFor(() => expect(trigger).toBeVisible());
    await expect(trigger).toHaveTextContent("Нещодавно додані");
  },
};

export const OpenMenu: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox", { name: "Сортування" });
    await userEvent.click(trigger);
    const listbox = within(document.body);
    await waitFor(() =>
      expect(listbox.getByRole("option", { name: "Найвищий рейтинг" })).toBeVisible(),
    );
  },
};
