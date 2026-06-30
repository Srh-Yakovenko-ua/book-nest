import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { FilterEntityItem } from "./library-filter-combobox";

import { LibraryFilterCombobox } from "./library-filter-combobox";

const ITEMS: FilterEntityItem[] = [
  { id: "author-king", isCustom: false, name: "Стівен Кінг" },
  { id: "author-custom", isCustom: true, name: "Мій автор" },
];

function Harness() {
  const [selected, setSelected] = useState<FilterEntityItem | null>(null);
  return (
    <div className="w-80">
      <LibraryFilterCombobox
        clearLabel="Очистити поле"
        customBadge="Власний"
        emptyLabel="Нічого не знайдено"
        icon="user"
        id="library-filter-author"
        label="Автор"
        onClear={() => setSelected(null)}
        onSelect={setSelected}
        placeholder="Пошук авторів"
        searchingLabel="Пошук…"
        useSearch={useMockSearch}
      />
      <p data-testid="selected">{selected === null ? "none" : selected.name}</p>
    </div>
  );
}

function useMockSearch(): { data: FilterEntityItem[]; isFetching: boolean } {
  return { data: ITEMS, isFetching: false };
}

const meta = {
  args: {
    clearLabel: "Очистити поле",
    customBadge: "Власний",
    emptyLabel: "Нічого не знайдено",
    icon: "user",
    id: "library-filter-author",
    label: "Автор",
    onClear: () => {},
    onSelect: () => {},
    placeholder: "Пошук авторів",
    searchingLabel: "Пошук…",
    useSearch: useMockSearch,
  },
  component: LibraryFilterCombobox,
  tags: ["ai-generated"],
  title: "Books/LibraryFilterCombobox",
} satisfies Meta<typeof LibraryFilterCombobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AccessibleName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Автор" })).toBeVisible();
  },
  render: () => <Harness />,
};

export const KeyboardSelect: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole("combobox", { name: "Автор" });
    await userEvent.click(input);
    await userEvent.type(input, "ав");
    const surface = within(document.body);
    await waitFor(() => expect(surface.getByText("Стівен Кінг")).toBeVisible());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(canvas.getByTestId("selected")).toHaveTextContent("Мій автор"));
  },
  render: () => <Harness />,
};
