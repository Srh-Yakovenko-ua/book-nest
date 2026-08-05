import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, fn, userEvent, waitFor } from "storybook/test";

import { makeNotification, notificationsOfEveryType } from "../model/notification.fixtures";
import { NotificationPanel } from "./notification-panel";

const meta = {
  args: {
    isMarkingAllRead: false,
    locale: "uk",
    onMarkAllRead: fn(),
    onMarkRead: fn(),
    onRetry: fn(),
    state: { kind: "loading" },
    unreadCount: 0,
  },
  component: NotificationPanel,
  decorators: [
    (Story) => (
      <div className="w-[22rem] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Notifications/NotificationPanel",
} satisfies Meta<typeof NotificationPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const readyState = {
  items: notificationsOfEveryType,
  kind: "ready",
  loadMore: null,
} as const;

export const Loading: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole("status")).toBeInTheDocument());
    await expect(canvas.getByText("Завантаження сповіщень…")).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  args: { state: { kind: "error" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole("alert")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "Спробувати ще раз" })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { state: { kind: "empty" } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Нагадувань немає")).toBeVisible());
  },
};

export const EveryNotificationType: Story = {
  args: {
    state: readyState,
    unreadCount: notificationsOfEveryType.filter((item) => item.readAt === null).length,
  },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Тестове сповіщення, усе працює")).toBeVisible());
    await expect(canvas.getByText("Олег має повернути «Тигролови» сьогодні")).toBeVisible();
    await expect(
      canvas.getByText("Позику «Місто» прострочено на 3 дні, позичальник — Ірина"),
    ).toBeVisible();
    await expect(canvas.getByText("у кошику")).toBeVisible();
  },
};

export const MarkAllRead: Story = {
  args: {
    state: { items: [makeNotification()], kind: "ready", loadMore: null },
    unreadCount: 1,
  },
  play: async ({ args, canvas }) => {
    const button = await canvas.findByRole("button", { name: "Прочитати все" });
    await userEvent.click(button);
    await expect(args.onMarkAllRead).toHaveBeenCalled();
  },
};

export const AllRead: Story = {
  args: {
    state: {
      items: [makeNotification({ readAt: "2026-07-30T10:00:00.000Z" })],
      kind: "ready",
      loadMore: null,
    },
    unreadCount: 0,
  },
  play: async ({ args, canvas }) => {
    const button = await canvas.findByRole("button", { name: "Прочитати все" });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    await expect(args.onMarkAllRead).not.toHaveBeenCalled();
  },
};

export const HasMorePages: Story = {
  args: {
    state: {
      items: notificationsOfEveryType,
      kind: "ready",
      loadMore: { onLoadMore: () => {}, status: "idle" },
    },
    unreadCount: 5,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: "Показати ще" })).toBeVisible();
  },
};

export const LoadMoreFailed: Story = {
  args: {
    state: {
      items: notificationsOfEveryType,
      kind: "ready",
      loadMore: { onLoadMore: () => {}, status: "failed" },
    },
    unreadCount: 5,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити наступні сповіщення",
    );
    await expect(canvas.getByRole("button", { name: "Показати ще" })).toBeVisible();
  },
};
