import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { BookPreview } from "./book-preview";

const meta = {
  args: {
    authorName: "",
    description: "",
    publisherName: "",
    title: "",
  },
  component: BookPreview,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Books/BookPreview",
} satisfies Meta<typeof BookPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Приклад назви")).toBeVisible();
    await expect(canvas.getByText("Автора не вказано")).toBeVisible();
  },
};

export const Filled: Story = {
  args: {
    authorName: "Михайло Коцюбинський",
    description: "Повість про кохання Івана та Марічки на тлі гуцульських звичаїв.",
    publisherName: "Видавництво Старого Лева",
    title: "Тіні забутих предків",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Тіні забутих предків")).toBeVisible();
    await expect(canvas.getByText("Михайло Коцюбинський")).toBeVisible();
    await expect(canvas.getByText("Видавництво Старого Лева")).toBeVisible();
  },
};

export const WithStatusBadges: Story = {
  args: {
    authorName: "Михайло Коцюбинський",
    ownershipStatus: "borrowed_from_someone",
    readingStatus: "finished",
    title: "Тіні забутих предків",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Прочитано")).toBeVisible();
    await expect(canvas.getByText("Позичив у когось")).toBeVisible();
  },
};

export const Rich: Story = {
  args: {
    authorName: "Анджей Сапковський",
    description:
      "Перша збірка оповідань про відьмака Геральта з Рівії — мисливця на чудовиськ у світі, де люди небезпечніші за монстрів.",
    formats: ["paper", "ebook", "audiobook"],
    genres: ["Фентезі", "Драма", "Класика", "Трилер", "Жахи"],
    inQueue: true,
    isFavorite: true,
    ownershipStatus: "owned",
    publisherName: "Клуб Сімейного Дозвілля",
    rating: 5,
    readingStatus: "finished",
    tags: ["улюблене", "фентезі", "сапковський", "відьмак", "польська-проза", "магія"],
    title: "Останнє бажання",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Останнє бажання")).toBeVisible();
    await expect(canvas.getByText("Анджей Сапковський")).toBeVisible();
    await expect(canvas.getByText("Прочитано")).toBeVisible();
    await expect(canvas.getByText("У наявності")).toBeVisible();
    await expect(canvas.getByText("Улюблене")).toBeVisible();
    await expect(canvas.getByText("У черзі читання")).toBeVisible();
    await expect(canvas.getByText("+1")).toBeVisible();
    await expect(canvas.getByText("+2")).toBeVisible();
    await expect(canvas.getByText("Формати")).toBeVisible();
  },
};
