import type { SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, waitFor } from "storybook/test";

import { SERIES_SORT_DEFAULT } from "../model/series-derive";
import { makeSeriesOverview, makeSeriesView } from "../model/series.fixtures";
import { AllSeriesView } from "./all-series-view";
import { SeriesSidebar } from "./series-sidebar";
import { type SeriesSummaryCard } from "./series-summary-cards";
import { SeriesToolbar } from "./series-toolbar";

const series: SeriesView[] = [
  makeSeriesView({ finishedInSeries: 3, id: "s1", name: "Пісня льоду й полум'я", totalBooks: 5 }),
  makeSeriesView({
    booksInSeries: 4,
    finishedInSeries: 4,
    id: "s2",
    name: "Володар перснів",
    nextBook: null,
    status: "completed",
    totalBooks: 4,
  }),
  makeSeriesView({
    booksInSeries: 0,
    finishedInSeries: 0,
    id: "s3",
    name: "Дюна",
    nextBook: null,
    status: "unknown",
    totalBooks: null,
  }),
  makeSeriesView({
    authors: [{ id: "a4", name: "Патрік Ротфусс" }],
    booksInSeries: 2,
    finishedInSeries: 0,
    id: "s4",
    name: "Хроніки вбивці короля",
    nextBook: { id: "kk-1", partNumber: 1, title: "Імʼя вітру" },
    totalBooks: 3,
  }),
];

const summaryCards: SeriesSummaryCard[] = [
  { icon: "layers", label: "Усього серій", value: 8 },
  { icon: "check-circle", label: "Прочитано", value: 2 },
  { icon: "book", label: "Недочитані", value: 5 },
  { icon: "library", label: "Книг у серіях", value: 14 },
];

const toolbar = (
  <SeriesToolbar
    onReadingChange={fn()}
    onSearchChange={fn()}
    onSearchClear={fn()}
    onSortChange={fn()}
    onStatusChange={fn()}
    readingFilter="all"
    search=""
    sort={SERIES_SORT_DEFAULT}
    statusFilter="all"
  />
);

const sidebar = (
  <SeriesSidebar
    isError={false}
    isLoading={false}
    onCreateSeries={fn()}
    onGoToUnfinished={fn()}
    onRetry={fn()}
    overview={makeSeriesOverview()}
  />
);

const meta = {
  args: {
    hasActiveQuery: false,
    hasAnySeries: true,
    isError: false,
    isPending: false,
    onAddBook: fn(),
    onClearFilters: fn(),
    onCreateSeries: fn(),
    onOverviewRetry: fn(),
    onRetry: fn(),
    onShowAll: fn(),
    onTabChange: fn(),
    series,
    sidebar,
    summaryCards,
    summaryError: false,
    summaryLoading: false,
    tab: "all",
    toolbar,
    totalCount: 8,
    unfinishedCount: 5,
  },
  component: AllSeriesView,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Series/AllSeriesView",
} satisfies Meta<typeof AllSeriesView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole("heading", { name: "Серії" })).toBeVisible());
    await expect(canvas.getByText("8 серій")).toBeVisible();
    await expect(canvas.getByText("Володар перснів")).toBeVisible();
    await expect(canvas.getByText("Усього серій")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isPending: true, series: [], summaryLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  args: { hasAnySeries: false, series: [], totalCount: 0, unfinishedCount: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "У вас ще немає серій" })).toBeVisible();
  },
};

export const UnfinishedEmpty: Story = {
  args: { series: [], tab: "unfinished" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Немає недочитаних серій" })).toBeVisible();
  },
};

export const NoResults: Story = {
  args: { hasActiveQuery: true, series: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Серій не знайдено" })).toBeVisible();
  },
};

export const ErrorState: Story = {
  args: { isError: true, series: [] },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Не вдалося завантажити серії" }),
    ).toBeVisible();
  },
};
