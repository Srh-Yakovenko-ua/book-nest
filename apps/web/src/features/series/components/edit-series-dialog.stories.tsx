import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { makeSeriesView } from "../model/series.fixtures";
import { EditSeriesDialog } from "./edit-series-dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <EditSeriesDialog
        onOpenChange={setOpen}
        open={open}
        series={makeSeriesView({ name: "Відьмак", totalBooks: 8 })}
      />
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
  args: { onOpenChange: () => {}, open: true, series: makeSeriesView() },
  component: EditSeriesDialog,
  parameters: { layout: "fullscreen" },
  render: () => <Harness />,
  tags: ["ai-generated"],
  title: "Series/EditSeriesDialog",
} satisfies Meta<typeof EditSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Prefilled: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Редагувати серію" })).toBeVisible(),
    );
    await expect(body.getByLabelText("Назва серії")).toHaveValue("Відьмак");
  },
};

export const DuplicateShowsInlineError: Story = {
  play: async () => {
    mockFetch(409, { message: "duplicate" });
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти зміни" }));
    await waitFor(() => expect(body.getByText("Серія з такою назвою вже існує")).toBeVisible());
    await expect(body.getByTestId("open-state")).toHaveTextContent("open");
  },
};

export const SubmitSuccessCloses: Story = {
  play: async () => {
    mockFetch(200, makeSeriesView({ name: "Відьмак" }));
    const body = within(document.body);
    await userEvent.click(body.getByRole("button", { name: "Зберегти зміни" }));
    await waitFor(() => expect(body.getByTestId("open-state")).toHaveTextContent("closed"));
  },
};
