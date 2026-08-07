import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { UiIcon } from "@/components/icons";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { statusEntry } from "@/lib/book-status.fixtures";

import { BookCard } from "./book-card";
import { Button } from "./button";

function makeCoverDataUrl(fill: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, 300, 400);
  }
  return canvas.toDataURL("image/png");
}

const reading = statusEntry(readingStatuses, "reading", "Читаю");
const finished = statusEntry(readingStatuses, "finished", "Прочитано");
const wantToRead = statusEntry(readingStatuses, "want_to_read", "Хочу прочитати");
const owned = statusEntry(ownershipStatuses, "owned", "У наявності");

function Kebab() {
  return (
    <Button aria-label="Дії" size="icon-sm" variant="ghost">
      <UiIcon name="more" size={18} />
    </Button>
  );
}

const meta = {
  args: {
    authors: ["Сара Дж. Маас"],
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
    genres: [
      { icon: "fentezi", label: "Фентезі" },
      { label: "Темне фентезі" },
      { label: "Романтика" },
    ],
    kebab: <Kebab />,
    progress: {
      current: 312,
      total: 768,
      unit: "стор.",
    },
    rating: 4,
    series: { href: "#series", name: "Двір шипів і троянд", positionLabel: "2 з 3" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Двір срібного полум'я")).toBeVisible();
    await expect(canvas.getByText("Читаю")).toBeVisible();
  },
};

export const Finished: Story = {
  args: {
    authors: ["Лі Бардуго"],
    genres: [{ icon: "fentezi", label: "Фентезі" }],
    kebab: <Kebab />,
    rating: 4.5,
    status: finished,
    title: "Шістка воронів",
  },
};

export const WantToRead: Story = {
  args: {
    authors: ["Медлін Міллер"],
    genres: [{ icon: "istorychnyy-roman", label: "Історична проза" }],
    kebab: <Kebab />,
    status: wantToRead,
    title: "Пісня Ахілла",
  },
};

export const Selected: Story = {
  args: {
    authors: ["Роберт Джексон Беннетт"],
    genres: [{ icon: "fentezi", label: "Фентезі" }],
    progress: {
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

export const ClickableCover: Story = {
  args: {
    cover: { alt: "Двір срібного полум'я", src: makeCoverDataUrl("#a96e47") },
    coverActivateLabel: "View cover",
    formats: [
      { icon: "book", label: "Паперова", value: "paper" },
      { icon: "headphones", label: "Аудіокнига", value: "audiobook" },
    ],
    genres: [{ icon: "fentezi", label: "Фентезі" }],
    kebab: <Kebab />,
    onCoverActivate: fn(),
    ownership: owned,
    rating: 4,
    status: reading,
  },
  play: async ({ args, canvas }) => {
    const cover = canvas.getByRole("button", { name: "View cover" });
    await expect(cover).toBeVisible();
    await userEvent.click(cover);
    await waitFor(() => expect(args.onCoverActivate).toHaveBeenCalledTimes(1));
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
        authors={["Сара Дж. Маас"]}
        genres={[{ icon: "fentezi", label: "Фентезі" }]}
        href="#book"
        kebab={<Kebab />}
        progress={{
          current: 312,
          total: 768,
          unit: "стор.",
        }}
        rating={4}
        series={{ href: "#series", name: "Двір шипів і троянд", positionLabel: "2 з 3" }}
        status={reading}
        title="Двір срібного полум'я"
      />
      <BookCard
        authors={["Лі Бардуго"]}
        genres={[{ icon: "fentezi", label: "Фентезі" }]}
        href="#book"
        kebab={<Kebab />}
        rating={4.5}
        status={finished}
        title="Шістка воронів"
      />
      <BookCard
        authors={["Медлін Міллер"]}
        genres={[{ icon: "istorychnyy-roman", label: "Історична проза" }]}
        href="#book"
        kebab={<Kebab />}
        status={wantToRead}
        title="Пісня Ахілла"
      />
    </div>
  ),
};
