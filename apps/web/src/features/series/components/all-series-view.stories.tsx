import type { SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, waitFor } from "storybook/test";

import { EMPTY_SERIES_ADVANCED_FILTERS, SERIES_SORT_DEFAULT } from "../model/series-derive";
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
    nextBook: { cover: null, id: "kk-1", partNumber: 1, title: "Імʼя вітру" },
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
    advancedFilters={EMPTY_SERIES_ADVANCED_FILTERS}
    onAdvancedApply={fn()}
    onReadingChange={fn()}
    onRememberAuthor={fn()}
    onSearchChange={fn()}
    onSearchClear={fn()}
    onSortChange={fn()}
    onStatusChange={fn()}
    onViewChange={fn()}
    readingFilter="all"
    resolveAuthorName={() => undefined}
    search=""
    sort={SERIES_SORT_DEFAULT}
    statusFilter="all"
    view="grid"
  />
);

const almostReadSeries: SeriesView[] = [
  makeSeriesView({
    finishedInSeries: 4,
    id: "almost-1",
    name: "Темна вежа",
    nextBook: { cover: null, id: "dt-5", partNumber: 5, title: "Вовки Кальї" },
    totalBooks: 5,
  }),
];

const sidebar = (
  <SeriesSidebar
    activeAttention={null}
    almostReadSeries={almostReadSeries}
    attentionCounts={{
      empty: 1,
      incomplete_data: 2,
      incomplete_set: 1,
      missing_parts: 1,
      next_unavailable: 1,
      unknown_status: 1,
    }}
    attentionLoading={false}
    isError={false}
    isLoading={false}
    onAttentionSelect={fn()}
    onRetry={fn()}
    overview={makeSeriesOverview()}
  />
);

const meta = {
  args: {
    activeFilters: null,
    counterLabel: "Показано 4 із 8 серій",
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
    unfinishedCount: 5,
    view: "grid",
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
    await expect(canvas.getByText("Володар перснів")).toBeVisible();
    await expect(canvas.getByText("Усього серій")).toBeVisible();
  },
};

export const ListView: Story = {
  args: { view: "list" },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Пісня льоду й полум'я")).toBeVisible());
    await expect(canvas.getByText("Володар перснів")).toBeVisible();
    await expect(canvas.getAllByRole("progressbar").length).toBeGreaterThan(0);
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
  args: { hasAnySeries: false, series: [], unfinishedCount: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Збери першу книжкову серію" })).toBeVisible();
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
