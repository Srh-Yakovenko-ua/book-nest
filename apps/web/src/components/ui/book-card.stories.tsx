import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons";
import { readingStatuses } from "@/lib/book-status";

import { BookCard } from "./book-card";
import { Button } from "./button";

const reading = readingStatuses.find((status) => status.value === "reading") ?? readingStatuses[0];
const finished =
  readingStatuses.find((status) => status.value === "finished") ?? readingStatuses[0];
const wantToRead =
  readingStatuses.find((status) => status.value === "want_to_read") ?? readingStatuses[0];

function Kebab() {
  return (
    <Button aria-label="Дії" size="icon-sm" variant="ghost">
      <UiIcon name="more" size={18} />
    </Button>
  );
}

const meta = {
  args: {
    author: "Сара Дж. Маас",
    status: reading,
    title: "Двір срібного полум'я",
  },
  component: BookCard,
  decorators: [
    (Story) => (
      <div className="w-[290px]">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/BookCard",
} satisfies Meta<typeof BookCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reading: Story = {
  args: {
    genre: { icon: "fentezi", label: "Фентезі" },
    kebab: <Kebab />,
    progress: {
      ariaLabel: "Прогрес читання: 312 з 768",
      current: 312,
      total: 768,
      unit: "стор.",
    },
    rating: 4,
    series: "Двір шипів і троянд · Книга 2 з 3",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Двір срібного полум'я")).toBeVisible();
    await expect(canvas.getByText("Читаю")).toBeVisible();
    await expect(canvas.getByText("312 / 768 стор.")).toBeVisible();
  },
};

export const Finished: Story = {
  args: {
    author: "Лі Бардуго",
    genre: { icon: "fentezi", label: "Фентезі" },
    kebab: <Kebab />,
    rating: 4.5,
    status: finished,
    title: "Шістка воронів",
  },
};

export const WantToRead: Story = {
  args: {
    author: "Медлін Міллер",
    genre: { icon: "istorychnyy-roman", label: "Історична проза" },
    kebab: <Kebab />,
    status: wantToRead,
    title: "Пісня Ахілла",
  },
};

export const Selected: Story = {
  args: {
    author: "Роберт Джексон Беннетт",
    genre: { icon: "fentezi", label: "Фентезі" },
    progress: {
      ariaLabel: "Прогрес читання: 87 з 452",
      current: 87,
      total: 452,
      unit: "стор.",
    },
    rating: 3.5,
    selected: true,
    status: reading,
    title: "Місто драбин",
  },
};

export const Grid: Story = {
  decorators: [
    (Story) => (
      <div className="w-[60rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
      <BookCard
        author="Сара Дж. Маас"
        genre={{ icon: "fentezi", label: "Фентезі" }}
        href="#book"
        kebab={<Kebab />}
        progress={{
          ariaLabel: "Прогрес читання: 312 з 768",
          current: 312,
          total: 768,
          unit: "стор.",
        }}
        rating={4}
        series="Двір шипів і троянд · Книга 2 з 3"
        status={reading}
        title="Двір срібного полум'я"
      />
      <BookCard
        author="Лі Бардуго"
        genre={{ icon: "fentezi", label: "Фентезі" }}
        href="#book"
        kebab={<Kebab />}
        rating={4.5}
        status={finished}
        title="Шістка воронів"
      />
      <BookCard
        author="Медлін Міллер"
        genre={{ icon: "istorychnyy-roman", label: "Історична проза" }}
        href="#book"
        kebab={<Kebab />}
        status={wantToRead}
        title="Пісня Ахілла"
      />
    </div>
  ),
};
