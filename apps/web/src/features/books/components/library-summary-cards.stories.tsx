import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { LibrarySummaryCards } from "./library-summary-cards";

const cards: LibrarySummaryCard[] = [
  { icon: "library", iconTone: "primary", label: "Усього книг", unit: "книг", value: 128 },
  { icon: "book", iconTone: "info", label: "Читаю", unit: "книги", value: 4 },
  { icon: "check-circle", iconTone: "success", label: "Прочитано", unit: "книг", value: 86 },
  {
    icon: "heart",
    iconTone: "favorite",
    label: "Улюблених",
    microfact: "13% бібліотеки",
    unit: "книг",
    value: 17,
  },
];

const favoritesCards: LibrarySummaryCard[] = [
  {
    icon: "heart",
    iconTone: "favorite",
    label: "Усього улюблених",
    microfact: "12 у серіях · 5 окремих",
    unit: "книг",
    value: 17,
  },
  {
    icon: "book",
    iconTone: "info",
    label: "Читаю",
    microfact: "24% улюблених читається зараз",
    unit: "книги",
    value: 4,
  },
  {
    icon: "check-circle",
    iconTone: "success",
    label: "Прочитано",
    microfact: "51% улюблених прочитано",
    unit: "книг",
    value: 9,
  },
  {
    icon: "star",
    iconTone: "primary",
    label: "Середній рейтинг",
    microfact: "Серед улюблених книг з оцінкою",
    value: "8.4",
  },
  {
    icon: "layers",
    iconTone: "ink",
    label: "Топ жанр",
    microfact: "9 улюблених у цьому жанрі",
    value: "Фентезі",
  },
  {
    icon: "tag",
    iconTone: "primary",
    label: "Топ тег",
    microfact: "6 улюблених з цим тегом",
    value: "slow burn",
  },
];

const favoritesEmptyTopStats: LibrarySummaryCard[] = [
  ...favoritesCards.slice(0, 4),
  {
    icon: "layers",
    iconTone: "ink",
    label: "Топ жанр",
    microfact: "Серед улюблених немає жанрів",
    value: "Немає жанру",
  },
  {
    icon: "tag",
    iconTone: "primary",
    label: "Топ тег",
    microfact: "Серед улюблених немає тегів",
    value: "Немає тегу",
  },
];

const meta = {
  args: { cards, isLoading: false },
  component: LibrarySummaryCards,
  tags: ["ai-generated"],
  title: "Books/LibrarySummaryCards",
} satisfies Meta<typeof LibrarySummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього книг")).toBeVisible());
    await expect(canvas.getByText("128")).toBeVisible();
    await expect(canvas.getByText("Улюблених")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const FavoritesSixCards: Story = {
  args: { cards: favoritesCards },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByText("Топ жанр")).toBeVisible());
    await expect(canvas.getByText("Фентезі")).toBeVisible();
    await expect(canvas.getByText("Топ тег")).toBeVisible();
    await expect(canvas.getByText("slow burn")).toBeVisible();
    await expect(canvasElement.querySelectorAll('[data-slot="stat-card"]')).toHaveLength(6);
  },
};

export const FavoritesEmptyTopStats: Story = {
  args: { cards: favoritesEmptyTopStats },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Немає жанру")).toBeVisible());
    await expect(canvas.getByText("Немає тегу")).toBeVisible();
    await expect(canvas.getByText("Серед улюблених немає жанрів")).toBeVisible();
  },
};
