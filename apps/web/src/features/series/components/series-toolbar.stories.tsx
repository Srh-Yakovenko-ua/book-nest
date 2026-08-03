import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { EMPTY_SERIES_ADVANCED_FILTERS, SERIES_SORT_DEFAULT } from "../model/series-derive";
import { SeriesToolbar } from "./series-toolbar";

const meta = {
  args: {
    advancedFilters: EMPTY_SERIES_ADVANCED_FILTERS,
    onAdvancedApply: fn(),
    onReadingChange: fn(),
    onRememberAuthor: fn(),
    onSearchChange: fn(),
    onSearchClear: fn(),
    onSortChange: fn(),
    onStatusChange: fn(),
    readingFilter: "all",
    resolveAuthorName: () => undefined,
    search: "",
    sort: SERIES_SORT_DEFAULT,
    statusFilter: "all",
  },
  component: SeriesToolbar,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Series/SeriesToolbar",
} satisfies Meta<typeof SeriesToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas }) => {
    const search = canvas.getByLabelText("Пошук серій");
    await expect(search).toBeVisible();
    await userEvent.type(search, "Відьмак");
    await waitFor(() => expect(args.onSearchChange).toHaveBeenCalled());
  },
};

export const WithActiveSearch: Story = {
  args: { search: "Відьмак" },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Очистити пошук" }));
    await waitFor(() => expect(args.onSearchClear).toHaveBeenCalled());
  },
};
