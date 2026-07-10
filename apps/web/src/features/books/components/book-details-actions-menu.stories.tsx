import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { BookDetailsActionsMenu } from "./book-details-actions-menu";
import { makeBookView } from "./book-details.fixtures";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(body: unknown) {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(200, body))) as typeof fetch;
}

async function openMenu(canvas: ReturnType<typeof within>) {
  await userEvent.click(canvas.getByRole("button", { name: "Дії з книгою" }));
  return within(document.body);
}

const meta = {
  component: BookDetailsActionsMenu,
  decorators: [
    (Story) => (
      <div className="p-10">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Books/BookDetailsActionsMenu",
} satisfies Meta<typeof BookDetailsActionsMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

function actionBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-actions00001",
    isInReadingQueue: false,
    ...overrides,
  });
}

export const ReadingMenu: Story = {
  args: { book: actionBook({ readingStatus: "reading" }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Оновити прогрес" })).toBeVisible(),
    );
    await expect(menu.getByRole("menuitem", { name: "Змінити статус читання" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Додати в чергу читання" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Додати до списку" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Видалити" })).toBeVisible();
  },
};

export const FinishedHidesUpdateProgress: Story = {
  args: { book: actionBook({ readingStatus: "finished" }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Змінити статус читання" })).toBeVisible(),
    );
    await expect(menu.queryByRole("menuitem", { name: "Оновити прогрес" })).toBeNull();
  },
};

export const AlreadyQueued: Story = {
  args: { book: actionBook({ isInReadingQueue: true }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: "Прибрати з черги читання" })).toBeVisible(),
    );
    await expect(
      menu.getByRole("menuitem", { name: "Прибрати з черги читання" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    await expect(menu.queryByRole("menuitem", { name: "Додати в чергу читання" })).toBeNull();
  },
};

export const OpensListDialog: Story = {
  args: { book: actionBook() },
  beforeEach: () => {
    mockFetch({
      lists: [
        {
          bookCount: 4,
          id: "11111111-1111-4111-8111-listaaaaaaaa",
          isMember: true,
          name: "Улюблене",
        },
        {
          bookCount: 2,
          id: "22222222-2222-4222-8222-listbbbbbbbb",
          isMember: false,
          name: "Прочитати влітку",
        },
      ],
    });
  },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await userEvent.click(menu.getByRole("menuitem", { name: "Додати до списку" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Додати до списку" })).toBeVisible(),
    );
    await waitFor(() =>
      expect(body.getByRole("button", { name: "Прибрати Улюблене" })).toBeVisible(),
    );
  },
};

export const OpensDeleteDialog: Story = {
  args: { book: actionBook({ title: "Останнє бажання" }) },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await userEvent.click(menu.getByRole("menuitem", { name: "Видалити" }));
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("alertdialog")).toBeVisible());
    await expect(body.getByText("Видалити книгу?")).toBeVisible();
  },
};

export const OpensStatusDialog: Story = {
  args: { book: actionBook() },
  play: async ({ canvas }) => {
    const menu = await openMenu(canvas);
    await userEvent.click(menu.getByRole("menuitem", { name: "Змінити статус читання" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Змінити статус читання" })).toBeVisible(),
    );
  },
};
