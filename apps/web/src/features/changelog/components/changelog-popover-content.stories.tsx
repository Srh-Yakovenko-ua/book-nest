import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { formatDateLong } from "@/lib/format";

import { ChangelogPopoverContent } from "./changelog-popover-content";
import { changelogEntries } from "./changelog.fixtures";

const meta = {
  args: {
    locale: "uk",
    onRetry: () => {},
    state: { kind: "loading" },
  },
  component: ChangelogPopoverContent,
  decorators: [
    (Story) => (
      <div className="w-[22rem] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Changelog/ChangelogPopoverContent",
} satisfies Meta<typeof ChangelogPopoverContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole("heading", { name: "Що нового" })).toBeVisible());
  },
};

export const ErrorState: Story = {
  args: { state: { kind: "error" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити оновлення")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Спробувати ще раз" })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { state: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Поки що оновлень немає")).toBeVisible());
  },
};

export const Ready: Story = {
  args: {
    state: {
      entries: changelogEntries,
      hasNextPage: false,
      isFetchingNextPage: false,
      kind: "ready",
      onEndReached: () => {},
    },
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Черга читання")).toBeVisible());
    await expect(canvas.getAllByText("Нове").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(canvas.getAllByText(formatDateLong("2026-07-10", "uk")).length).toBeGreaterThan(0),
    );
  },
};

export const FetchingNextPage: Story = {
  args: {
    state: {
      entries: changelogEntries.slice(0, 3),
      hasNextPage: true,
      isFetchingNextPage: true,
      kind: "ready",
      onEndReached: () => {},
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByText("Черга читання")).toBeVisible());
    await expect(
      canvasElement.querySelector('[data-slot="changelog-loading-more"]'),
    ).not.toBeNull();
  },
};
