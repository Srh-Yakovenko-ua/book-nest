import type { SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { makeSeriesView } from "../model/series.fixtures";
import { EditSeriesDialog } from "./edit-series-dialog";

const EMPTY_AUTHORS_PAGE = { items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 };

function Harness({
  series = makeSeriesView({ name: "Відьмак", totalBooks: 8 }),
}: {
  series?: SeriesView;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <EditSeriesDialog onOpenChange={setOpen} open={open} series={series} />
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
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/authors/recent")) return Promise.resolve(jsonResponse(200, []));
    if (url.includes("/api/authors")) {
      return Promise.resolve(jsonResponse(200, EMPTY_AUTHORS_PAGE));
    }
    return Promise.resolve(jsonResponse(status, body));
  }) as typeof fetch;
}

const meta = {
  args: { onOpenChange: () => {}, open: true, series: makeSeriesView() },
  beforeEach: () => {
    mockFetch(200, makeSeriesView());
  },
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

export const EmptySeriesShowsEditableAuthors: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByRole("heading", { name: "Редагувати серію" })).toBeVisible(),
    );
    await expect(
      body.queryByText("Авторів серії визначають автори її книг"),
    ).not.toBeInTheDocument();
  },
  render: () => (
    <Harness series={makeSeriesView({ authors: [], booksInSeries: 0, name: "Відьмак" })} />
  ),
};

export const SeriesWithBooksShowsDerivedAuthors: Story = {
  play: async () => {
    const body = within(document.body);
    await waitFor(() =>
      expect(body.getByText("Авторів серії визначають автори її книг")).toBeVisible(),
    );
    await expect(body.getByText("Ребекка Яррос")).toBeVisible();
  },
  render: () => (
    <Harness
      series={makeSeriesView({
        authors: [{ id: "author-1", name: "Ребекка Яррос" }],
        booksInSeries: 4,
        name: "Емпіреї",
      })}
    />
  ),
};
