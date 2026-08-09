import type { BookView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeBookView } from "./book-details.fixtures";
import { OwnershipBlock } from "./ownership-block";

function ownershipBook(overrides: Partial<BookView> = {}): BookView {
  return makeBookView({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-owner0000001",
    loanInfo: null,
    ownershipStatus: "none",
    purchaseInfo: null,
    ...overrides,
  });
}

const meta = {
  component: OwnershipBlock,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-80 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  tags: ["ai-generated"],
  title: "Books/OwnershipBlock",
} satisfies Meta<typeof OwnershipBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const None: Story = {
  args: { book: ownershipBook() },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Володіння")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Маю цю книгу" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Додати до списку бажань" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позичена у когось" })).toBeVisible();
  },
};

export const OpensBuyDialog: Story = {
  args: { book: ownershipBook() },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Додати до списку бажань" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Додати до списку бажань" })).toBeVisible(),
    );
  },
};

export const OpensLoanDialog: Story = {
  args: { book: ownershipBook() },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Позичена у когось" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Позначити як позичену" })).toBeVisible(),
    );
    await expect(body.getByText("У кого взяли")).toBeVisible();
  },
};

export const Owned: Story = {
  args: { book: ownershipBook({ ownershipStatus: "owned" }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Дати комусь почитати" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Прибрати з моїх" })).toBeVisible();
    await expect(canvas.queryByText("Придбання")).toBeNull();
  },
};

export const OwnedWithAcquisition: Story = {
  args: {
    book: ownershipBook({
      ownershipStatus: "owned",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: "Прихована нотатка",
        purchasedAt: "2026-06-15",
        storeName: "Yakaboo",
        storeUrl: "https://www.yakaboo.ua/ostannie-bazhannja.html",
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Придбання")).toBeVisible();
    await expect(canvas.getByText("Придбано")).toBeVisible();
    await expect(canvas.getByText("Yakaboo")).toBeVisible();
    await expect(canvas.getByText("450 UAH")).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
    await expect(canvas.queryByText("Прихована нотатка")).toBeNull();
  },
};

export const WantToBuyWithPurchase: Story = {
  args: {
    book: ownershipBook({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: "Стара нотатка покупки",
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: "https://www.yakaboo.ua/ostannie-bazhannja.html",
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Де купити")).toBeVisible();
    await expect(canvas.getByText("Yakaboo")).toBeVisible();
    await expect(canvas.getByText("450 UAH")).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Перейти до магазину/ })).toBeVisible();
    await expect(canvas.queryByText("Стара нотатка покупки")).toBeNull();
    await expect(canvas.getByRole("button", { name: "Позначити купленою" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позначити замовленою" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Вже маю цю книгу" })).toBeVisible();
  },
};

export const OpensMarkBoughtDialog: Story = {
  args: {
    book: ownershipBook({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: null,
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: null,
      },
    }),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Позначити купленою" }));
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Позначити книгу як куплену?" })).toBeVisible(),
    );
    await expect(body.getByText("Yakaboo — 450 UAH")).toBeVisible();
    await expect(body.getByRole("radio", { name: "Інше місце" })).toBeVisible();
  },
};

export const BorrowedWithLoan: Story = {
  args: {
    book: ownershipBook({
      loanInfo: {
        contact: "@olha",
        expectedReturnDate: "2026-08-01",
        loanDate: "2026-06-01",
        loanType: "borrowed_from_someone",
        loanUiStatus: "on_time",
        note: null,
        personName: "Ольга",
        remindToReturn: true,
      },
      ownershipStatus: "borrowed_from_someone",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Деталі позики")).toBeVisible();
    await expect(canvas.getByText("У кого позичена")).toBeVisible();
    await expect(canvas.getByText("Ольга")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позначити як повернуту" })).toBeVisible();
  },
};

export const LentOverdue: Story = {
  args: {
    book: ownershipBook({
      loanInfo: {
        contact: null,
        expectedReturnDate: "2026-01-01",
        loanDate: "2025-12-01",
        loanType: "lent_to_someone",
        loanUiStatus: "overdue",
        note: null,
        personName: "Іван",
        remindToReturn: false,
      },
      ownershipStatus: "lent_to_someone",
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Кому передана")).toBeVisible();
    await expect(canvas.getByText(/Прострочено/)).toBeVisible();
  },
};
