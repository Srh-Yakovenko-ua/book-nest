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
    await expect(canvas.getByRole("button", { name: "Хочу купити" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Позичена у когось" })).toBeVisible();
  },
};

export const OpensBuyDialog: Story = {
  args: { book: ownershipBook() },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Хочу купити" }));
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("heading", { name: "Хочу купити" })).toBeVisible());
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
  },
};

export const WantToBuyWithPurchase: Story = {
  args: {
    book: ownershipBook({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: "Дочекатися знижки",
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: "https://www.yakaboo.ua/ostannie-bazhannja.html",
      },
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Деталі покупки")).toBeVisible();
    await expect(canvas.getByText("Yakaboo")).toBeVisible();
    await expect(canvas.getByText("450 UAH")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Куплена" })).toBeVisible();
  },
};

export const BorrowedWithLoan: Story = {
  args: {
    book: ownershipBook({
      loanInfo: {
        contact: "@olha",
        expectedReturnDate: "2026-08-01",
        loanDate: "2026-06-01",
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
