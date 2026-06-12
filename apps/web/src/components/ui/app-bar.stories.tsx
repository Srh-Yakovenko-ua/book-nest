import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AppBar } from "./app-bar";

function Logo() {
  return (
    <span className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
      <UiIcon className="text-primary" name="book" size={22} />
      BookNest
    </span>
  );
}

function Utilities() {
  return (
    <>
      <Button aria-label="Пошук" size="icon-sm" variant="ghost">
        <UiIcon name="search" size={18} />
      </Button>
      <Button aria-label="Перемкнути тему" size="icon-sm" variant="ghost">
        <UiIcon name="moon" size={18} />
      </Button>
      <Avatar size="sm">
        <AvatarFallback>СЛ</AvatarFallback>
      </Avatar>
    </>
  );
}

const meta = {
  args: {
    leading: <Logo />,
    title: "Моя бібліотека",
    trailing: <Utilities />,
  },
  component: AppBar,
  decorators: [
    (Story) => (
      <div className="w-[860px] overflow-hidden rounded-xl border border-border">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "UI/AppBar",
} satisfies Meta<typeof AppBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Моя бібліотека")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Пошук" })).toBeVisible();
  },
};

export const WithBurgerAndAction: Story = {
  args: {
    leading: (
      <Button aria-label="Меню" size="icon-sm" variant="ghost">
        <UiIcon name="menu" size={20} />
      </Button>
    ),
    surface: "card",
    title: (
      <>
        <span className="min-w-0 truncate">Двір срібного полум&apos;я</span>
        <Badge variant="primary">Книга 2</Badge>
      </>
    ),
    trailing: (
      <Button size="sm">
        <UiIcon name="plus" size={16} />
        Додати книгу
      </Button>
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    leading: undefined,
    title: "Статистика",
    trailing: undefined,
  },
};
