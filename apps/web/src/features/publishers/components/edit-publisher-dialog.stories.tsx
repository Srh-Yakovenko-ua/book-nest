import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makePublisherDetail } from "../model/publisher.fixtures";
import { EditPublisherDialog } from "./edit-publisher-dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <EditPublisherDialog
      details={makePublisherDetail({ isCustom: true, name: "Vivat" })}
      onOpenChange={setOpen}
      open={open}
    />
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (() => Promise.resolve(jsonResponse(status, body))) as typeof fetch;
}

const meta = {
  args: {
    details: makePublisherDetail({ isCustom: true, name: "Vivat" }),
    onOpenChange: () => {},
    open: true,
  },
  component: EditPublisherDialog,
  parameters: { layout: "fullscreen" },
  render: () => <Harness />,
  tags: ["ai-generated"],
  title: "Publishers/EditPublisherDialog",
} satisfies Meta<typeof EditPublisherDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Prefilled: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Редагувати видавництво" })).toBeVisible(),
    );
    await expect(body.getByLabelText("Назва")).toHaveValue("Vivat");
  },
};

export const DuplicateShowsInlineError: Story = {
  play: async () => {
    mockFetch(409, { message: "duplicate" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.getByText("Видавництво з такою назвою вже існує")).toBeVisible(),
    );
  },
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, makePublisherDetail({ isCustom: true, name: "Vivat" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти" }));
    await waitFor(() =>
      expect(body.queryByRole("heading", { name: "Редагувати видавництво" })).toBeNull(),
    );
  },
};
