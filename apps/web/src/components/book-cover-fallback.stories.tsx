import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { BookCoverFallback } from "./book-cover-fallback";

const SEEDS_BY_COVER = [
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
] as const;

const TITLES = {
  long: "Сто років самотності та ще одна дуже довга назва для перевірки переносу",
  short: "Дюна",
} as const;

const meta = {
  args: {
    seed: SEEDS_BY_COVER[0],
    sizes: "14rem",
    title: TITLES.short,
  },
  component: BookCoverFallback,
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Components/BookCoverFallback",
} satisfies Meta<typeof BookCoverFallback>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Titled: Story = {
  args: { className: "aspect-3/4 w-full rounded-lg" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(TITLES.short)).toBeInTheDocument();
  },
};

export const AllTones: Story = {
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {SEEDS_BY_COVER.flatMap((seed) => [
        <BookCoverFallback
          className="aspect-3/4 w-full rounded-lg"
          key={`${seed}-short`}
          seed={seed}
          sizes="(min-width: 1024px) 10rem, 45vw"
          title={TITLES.short}
        />,
        <BookCoverFallback
          className="aspect-3/4 w-full rounded-lg"
          key={`${seed}-long`}
          seed={seed}
          sizes="(min-width: 1024px) 10rem, 45vw"
          title={TITLES.long}
        />,
      ])}
    </div>
  ),
};

export const Thumbnails: Story = {
  render: () => (
    <div className="flex gap-2">
      {SEEDS_BY_COVER.map((seed) => (
        <BookCoverFallback className="h-12 w-9 rounded-sm" key={seed} seed={seed} sizes="2.25rem" />
      ))}
    </div>
  ),
};
