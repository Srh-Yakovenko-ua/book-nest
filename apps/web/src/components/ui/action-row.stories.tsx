import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent } from "storybook/test";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import { ActionList } from "./action-list";
import { ActionRow } from "./action-row";

const meta = {
  args: {
    leadingIcon: "list",
    title: "Додати до списку",
  },
  component: ActionRow,
  decorators: [
    (Story) => (
      <div className="w-[360px] rounded-xl border border-border bg-card p-2 shadow-card">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/ActionRow",
} satisfies Meta<typeof ActionRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    onClick: fn(),
    trailing: <UiIcon name="chevron-right" size={18} />,
  },
  play: async ({ args, canvas }) => {
    const row = canvas.getByRole("button", { name: /додати до списку/i });
    await userEvent.click(row);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Static: Story = {
  args: {
    leadingIcon: "book",
    subtitle: "Паперова · 768 сторінок",
    title: "Формат",
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText("Формат")).toBeVisible();
  },
};

export const WithValue: Story = {
  args: {
    leadingIcon: "refresh",
    onClick: fn(),
    title: "Змінити статус",
    trailing: (
      <>
        Читаю
        <UiIcon name="chevron-right" size={18} />
      </>
    ),
  },
};

export const WithBadge: Story = {
  args: {
    leadingIcon: "bell",
    onClick: fn(),
    title: "Сповіщення",
    trailing: <Badge variant="primary">12</Badge>,
  },
};

export const SoftSquare: Story = {
  args: {
    leadingIcon: "settings",
    leadingSquare: true,
    onClick: fn(),
    subtitle: "Тема, мова, сповіщення",
    title: "Налаштування",
    trailing: <UiIcon name="chevron-right" size={18} />,
  },
};

export const Danger: Story = {
  args: {
    leadingIcon: "trash",
    onClick: fn(),
    title: "Видалити список",
    tone: "danger",
  },
};

export const States: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <ActionList>
      <ActionRow leadingIcon="list" onClick={() => undefined} title="Додати до списку" />
      <ActionRow
        leadingIcon="refresh"
        onClick={() => undefined}
        title="Змінити статус"
        trailing={<UiIcon name="chevron-right" size={18} />}
      />
      <ActionRow disabled leadingIcon="upload" onClick={() => undefined} title="Експорт списку" />
      <ActionRow
        leadingIcon="trash"
        onClick={() => undefined}
        title="Видалити список"
        tone="danger"
      />
    </ActionList>
  ),
};
