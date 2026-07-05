import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeSeriesView } from "../model/series.fixtures";
import { CreateSeriesDialog } from "./create-series-dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <CreateSeriesDialog onOpenChange={setOpen} open={open} />
      <p data-testid="open-state">{open ? "open" : "closed"}</p>
    </>
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
  args: { onOpenChange: () => {}, open: true },
  component: CreateSeriesDialog,
  parameters: { layout: "fullscreen" },
  render: () => <Harness />,
  tags: ["ai-generated"],
  title: "Series/CreateSeriesDialog",
} satisfies Meta<typeof CreateSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("heading", { name: "Нова серія" })).toBeVisible());
    await expect(body.getByLabelText("Назва серії")).toBeVisible();
    await expect(body.getByRole("button", { name: "Створити серію" })).toBeVisible();
  },
};

export const DuplicateShowsInlineError: Story = {
  play: async () => {
    mockFetch(409, { message: "duplicate" });
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Назва серії"), "Відьмак");
    await userEvent.click(body.getByRole("button", { name: "Створити серію" }));
    await waitFor(() => expect(body.getByText("Серія з такою назвою вже існує")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, makeSeriesView({ name: "Відьмак" }));
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Назва серії"), "Відьмак");
    await userEvent.click(body.getByRole("button", { name: "Створити серію" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
};
