import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { SeriesSummaryCards } from "./series-summary-cards";

const cards: LibrarySummaryCard[] = [
  { icon: "layers", iconTone: "primary", label: "Усього серій", value: 8 },
  { icon: "check-circle", iconTone: "success", label: "Прочитано", value: 2 },
  { icon: "book", iconTone: "info", label: "Недочитані", value: 5 },
  { icon: "library", iconTone: "primary", label: "Книг у серіях", value: 14 },
];

const cardsWithMicrofacts: LibrarySummaryCard[] = [
  {
    icon: "layers",
    iconTone: "primary",
    label: "Усього серій",
    microfact: "3 завершені · 5 ще виходять",
    value: 8,
  },
  {
    icon: "check-circle",
    iconTone: "success",
    label: "Прочитано",
    microfact: "25% усіх серій",
    value: 2,
  },
  {
    icon: "book",
    iconTone: "info",
    label: "Недочитані",
    microfact: "лишилося 12 книг",
    value: 5,
  },
  {
    icon: "library",
    iconTone: "primary",
    label: "Книг у серіях",
    microfact: "прочитано 9 з 14",
    value: 14,
  },
];

const cardsEmpty: LibrarySummaryCard[] = [
  { icon: "layers", iconTone: "primary", label: "Усього серій", value: 0 },
  { icon: "check-circle", iconTone: "success", label: "Прочитано", value: 0 },
  { icon: "book", iconTone: "info", label: "Недочитані", value: 0 },
  { icon: "library", iconTone: "primary", label: "Книг у серіях", value: 0 },
];

const meta = {
  args: { cards, isError: false, isLoading: false, onRetry: fn() },
  component: SeriesSummaryCards,
  tags: ["ai-generated"],
  title: "Series/SeriesSummaryCards",
} satisfies Meta<typeof SeriesSummaryCards>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього серій")).toBeVisible());
    await expect(canvas.getByText("14")).toBeVisible();
    await expect(canvas.getByText("Книг у серіях")).toBeVisible();
  },
};

export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const ErrorState: Story = {
  args: { isError: true },
  play: async ({ args, canvas }) => {
    await waitFor(() => expect(canvas.getByText("Не вдалося завантажити серії")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Спробувати ще раз" }));
    await waitFor(() => expect(args.onRetry).toHaveBeenCalled());
  },
};

export const WithMicrofacts: Story = {
  args: { cards: cardsWithMicrofacts },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("3 завершені · 5 ще виходять")).toBeVisible());
    await expect(canvas.getByText("25% усіх серій")).toBeVisible();
    await expect(canvas.getByText("лишилося 12 книг")).toBeVisible();
    await expect(canvas.getByText("прочитано 9 з 14")).toBeVisible();
  },
};

export const MicrofactsHiddenWhenEmpty: Story = {
  args: { cards: cardsEmpty },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Усього серій")).toBeVisible());
    await expect(canvas.queryByText("3 завершені · 5 ще виходять")).toBeNull();
    await expect(canvas.queryByText("25% усіх серій")).toBeNull();
    await expect(canvas.queryByText("лишилося 12 книг")).toBeNull();
    await expect(canvas.queryByText("прочитано 9 з 14")).toBeNull();
  },
};
