import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { BookTagsDialog } from "./book-tags-dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  const [confirmed, setConfirmed] = useState<null | string[]>(null);
  return (
    <>
      <BookTagsDialog
        bookCount={3}
        onConfirm={async (tags) => setConfirmed(tags)}
        onOpenChange={setOpen}
        open={open}
      />
      <p data-testid="confirmed">{confirmed === null ? "none" : confirmed.join(",")}</p>
    </>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockTagsSearch(items: { id: string; name: string }[]) {
  globalThis.fetch = (() =>
    Promise.resolve(
      jsonResponse(200, { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length }),
    )) as typeof fetch;
}

const meta = {
  args: { bookCount: 3, onConfirm: async () => {}, onOpenChange: () => {}, open: true },
  component: BookTagsDialog,
  tags: ["ai-generated"],
  title: "Books/BookTagsDialog",
} satisfies Meta<typeof BookTagsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CreateWithKeyboard: Story = {
  play: async () => {
    mockTagsSearch([]);
    const surface = within(document.body);
    const input = await surface.findByRole("combobox", { name: "Теги" });
    await userEvent.click(input);
    await userEvent.type(input, "magic");
    await waitFor(() => expect(surface.getByText("Створити «magic»")).toBeVisible());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(surface.getByText("magic")).toBeVisible());
    await expect(surface.getByRole("button", { name: "Додати" })).toBeEnabled();
  },
  render: () => <Harness />,
};

export const PickSuggestionWithKeyboard: Story = {
  play: async () => {
    mockTagsSearch([{ id: "tag-1", name: "slow burn" }]);
    const surface = within(document.body);
    const input = await surface.findByRole("combobox", { name: "Теги" });
    await userEvent.click(input);
    await userEvent.type(input, "slow");
    await waitFor(() => expect(surface.getByText("slow burn")).toBeVisible());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(surface.getAllByText("slow burn").length).toBeGreaterThan(0));
  },
  render: () => <Harness />,
};
