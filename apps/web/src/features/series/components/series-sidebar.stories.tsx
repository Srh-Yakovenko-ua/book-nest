import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { makeSeriesOverview, makeSeriesView } from "../model/series.fixtures";
import { SeriesSidebar } from "./series-sidebar";

const almostReadSeries = [
  makeSeriesView({
    finishedInSeries: 4,
    id: "almost-1",
    name: "Темна вежа",
    nextBook: { cover: null, id: "dt-5", partNumber: 5, title: "Вовки Кальї" },
    totalBooks: 5,
  }),
  makeSeriesView({
    finishedInSeries: 2,
    id: "almost-2",
    name: "Гіперіон",
    nextBook: { cover: null, id: "hyp-3", partNumber: 3, title: "Ендіміон" },
    totalBooks: 4,
  }),
];

const meta = {
  args: {
    activeAttention: null,
    almostReadSeries,
    attentionCounts: { empty: 2, incomplete_data: 3, incomplete_set: 1, unknown_status: 4 },
    attentionLoading: false,
    isError: false,
    isLoading: false,
    onAttentionSelect: fn(),
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
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText("Продовжити читання")).toBeVisible();
    await expect(canvas.getByText("Наступна книга")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /Обкладинка книги/ })).toBeVisible();
    await expect(canvas.getByText("Серії, які майже прочитані")).toBeVisible();
    await expect(canvas.getByText("Далі: Вовки Кальї")).toBeVisible();
    await expect(canvas.getByText("Потребують уваги")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /без доданих книг/ }));
    await waitFor(() => expect(args.onAttentionSelect).toHaveBeenCalledWith("empty"));
  },
};

export const Empty: Story = {
  args: {
    almostReadSeries: [],
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

export const AllClear: Story = {
  args: {
    attentionCounts: { empty: 0, incomplete_data: 0, incomplete_set: 0, unknown_status: 0 },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Усі серії впорядковані")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { attentionLoading: true, isLoading: true, overview: undefined },
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
