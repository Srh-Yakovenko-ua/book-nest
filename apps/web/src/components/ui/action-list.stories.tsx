import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { ActionList } from "./action-list";
import { ActionRow } from "./action-row";

const meta = {
  component: ActionList,
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/ActionList",
} satisfies Meta<typeof ActionList>;

export default meta;

type Story = StoryObj<typeof meta>;

const chevron = <UiIcon name="chevron-right" size={18} />;

export const Settings: Story = {
  render: () => (
    <ActionList title="Налаштування">
      <ActionRow
        leadingIcon="user"
        leadingSquare
        onClick={() => undefined}
        subtitle="Імʼя, аватар, біографія"
        title="Профіль"
        trailing={chevron}
      />
      <ActionRow
        leadingIcon="bell"
        leadingSquare
        subtitle="Нагадування про книги"
        title="Сповіщення"
        trailing={(labelId) => <Switch aria-labelledby={labelId} defaultChecked />}
      />
      <ActionRow
        leadingIcon="palette"
        leadingSquare
        onClick={() => undefined}
        subtitle="Тема, акцентний колір"
        title="Вигляд"
        trailing={
          <>
            Системна
            {chevron}
          </>
        }
      />
      <ActionRow
        leadingIcon="globe"
        leadingSquare
        onClick={() => undefined}
        subtitle="Мова інтерфейсу"
        title="Регіон"
        trailing={<Badge variant="primary">UA</Badge>}
      />
    </ActionList>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Налаштування" })).toBeVisible();
    await expect(canvas.getByRole("list")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /профіль/i })).toBeVisible();
    await expect(canvas.getByRole("switch", { name: /сповіщення/i })).toBeChecked();
  },
};

export const QuickActions: Story = {
  render: () => (
    <ActionList dividers icon="sprig" title="Швидкі дії">
      <ActionRow
        leadingIcon="refresh"
        onClick={() => undefined}
        title="Змінити статус"
        trailing={
          <>
            Читаю
            {chevron}
          </>
        }
      />
      <ActionRow
        leadingIcon="list"
        onClick={() => undefined}
        title="Додати до списку"
        trailing={chevron}
      />
      <ActionRow leadingIcon="share" onClick={() => undefined} title="Поділитися" />
      <ActionRow
        leadingIcon="trash"
        onClick={() => undefined}
        title="Видалити книгу"
        tone="danger"
      />
    </ActionList>
  ),
};
