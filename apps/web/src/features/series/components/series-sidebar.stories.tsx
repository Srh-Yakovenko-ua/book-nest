import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { makeSeriesOverview } from "../model/series.fixtures";
import { SeriesSidebar } from "./series-sidebar";

const meta = {
  args: {
    isError: false,
    isLoading: false,
    onRetry: fn(),
    overview: makeSeriesOverview(),
  },
  component: SeriesSidebar,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-80 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/SeriesSidebar",
} satisfies Meta<typeof SeriesSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Продовжити читання")).toBeVisible();
    await expect(canvas.getByText("Наступна книга")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /Обкладинка книги/ })).toBeVisible();
    await expect(canvas.getByText("Статус циклів")).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    overview: makeSeriesOverview({
      statusCounts: { completed: 0, ongoing: 0, unknown: 0 },
      topUnfinished: [],
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Немає недочитаних серій")).toBeVisible();
    await expect(canvas.getByText("Поки що немає прогресу")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true, overview: undefined },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const ErrorState: Story = {
  args: { isError: true, overview: undefined },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText("Не вдалося завантажити серії")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Спробувати ще раз" }));
    await waitFor(() => expect(args.onRetry).toHaveBeenCalled());
  },
};
