import type { AuthorView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { type AuthorSelection, type SeriesSelection } from "../model/create-book-form";
import { CreateSeriesDialog } from "./create-series-dialog";

type AuthorSeed = { id: string; isCustom?: boolean; name: string };

type NewSeries = Extract<SeriesSelection, { kind: "new" }>;

function authorView(seed: AuthorSeed): AuthorView {
  return {
    bio: null,
    birthYear: null,
    countryCode: null,
    deathYear: null,
    id: seed.id,
    isCustom: seed.isCustom ?? false,
    name: seed.name,
    openLibraryKey: null,
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: null,
  };
}

function Harness({
  authorSelections = [],
  initialName = "Відьмак",
}: {
  authorSelections?: AuthorSelection[];
  initialName?: string;
}) {
  const [confirmed, setConfirmed] = useState<NewSeries | null>(null);
  return (
    <div className="w-96">
      <CreateSeriesDialog
        authorSelections={authorSelections}
        initialName={initialName}
        onConfirm={setConfirmed}
        onOpenChange={() => undefined}
        open
      />
      <p data-testid="confirmed-authors">
        {confirmed === null ? "none" : JSON.stringify(confirmed.draft.authors)}
      </p>
    </div>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockAuthors({ all = [], recent = [] }: { all?: AuthorSeed[]; recent?: AuthorSeed[] }) {
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/authors/recent")) {
      return Promise.resolve(jsonResponse(200, recent.map(authorView)));
    }
    return Promise.resolve(
      jsonResponse(200, {
        items: all.map(authorView),
        page: 1,
        pagesCount: 1,
        pageSize: 12,
        totalCount: all.length,
      }),
    );
  }) as typeof fetch;
}

const meta = {
  args: {
    authorSelections: [],
    initialName: "Відьмак",
    onConfirm: () => undefined,
    onOpenChange: () => undefined,
    open: true,
  },
  beforeEach: () => {
    mockAuthors({});
  },
  component: CreateSeriesDialog,
  tags: ["ai-generated"],
  title: "Books/CreateSeriesDialog",
} satisfies Meta<typeof CreateSeriesDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAPKOWSKI_ID = "11111111-1111-4111-8111-111111111111";
const SAPKOWSKI: AuthorSelection = { id: SAPKOWSKI_ID, kind: "catalog", name: "Сапковський" };

export const PrefilledFromBook: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const dialog = within(await surface.findByRole("dialog"));

    await expect(dialog.getByLabelText("Назва серії")).toHaveValue("Відьмак");
    await expect(
      dialog.getByRole("button", { name: "Видалити автора «Сапковський»" }),
    ).toBeVisible();

    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));

    await waitFor(() =>
      expect(canvas.getByTestId("confirmed-authors")).toHaveTextContent(
        `[{"id":"${SAPKOWSKI_ID}"}]`,
      ),
    );
  },
  render: () => <Harness authorSelections={[SAPKOWSKI]} />,
};

export const AuthorsAreEditable: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const dialog = within(await surface.findByRole("dialog"));

    await userEvent.click(dialog.getByRole("button", { name: "Видалити автора «Сапковський»" }));
    await waitFor(() =>
      expect(dialog.queryByRole("button", { name: "Видалити автора «Сапковський»" })).toBeNull(),
    );

    const authorsInput = dialog.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(authorsInput);
    await userEvent.type(authorsInput, "Новий Автор");
    await userEvent.click(await surface.findByText("Створити «Новий Автор»"));

    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));

    await waitFor(() =>
      expect(canvas.getByTestId("confirmed-authors")).toHaveTextContent('[{"name":"Новий Автор"}]'),
    );
  },
  render: () => <Harness authorSelections={[SAPKOWSKI]} />,
};
