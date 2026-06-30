import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { type AuthorSelection } from "../model/create-book-form";
import { AuthorsField } from "./authors-field";

type AuthorFixture = { id: string; isCustom?: boolean; name: string };

function authorPage(items: AuthorFixture[]) {
  return jsonResponse(200, {
    items: items.map(authorView),
    page: 1,
    pagesCount: 1,
    pageSize: 12,
    totalCount: items.length,
  });
}

function authorView(item: AuthorFixture) {
  return {
    bio: null,
    birthYear: null,
    countryCode: null,
    deathYear: null,
    id: item.id,
    isCustom: item.isCustom ?? false,
    name: item.name,
    openLibraryKey: null,
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: null,
  };
}

function Harness({ initial = [] }: { initial?: AuthorSelection[] }) {
  const [value, setValue] = useState<AuthorSelection[]>(initial);
  return (
    <div className="w-80">
      <label className="sr-only" htmlFor="authors">
        Автори
      </label>
      <AuthorsField id="authors" invalid={false} onChange={setValue} value={value} />
      <p data-testid="selection">
        {value.length === 0
          ? "none"
          : value.map((author) => `${author.kind}:${author.name}`).join(" | ")}
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

function mockAuthors({
  all = [],
  recent = [],
}: {
  all?: AuthorFixture[];
  recent?: AuthorFixture[];
}) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    if (path.includes("/api/authors/recent")) {
      return Promise.resolve(jsonResponse(200, recent.map(authorView)));
    }
    return Promise.resolve(authorPage(all));
  }) as typeof fetch;
}

const meta = {
  args: {
    id: "authors",
    invalid: false,
    onChange: () => undefined,
    value: [],
  },
  beforeEach: () => {
    getQueryClient().clear();
    mockAuthors({});
  },
  component: AuthorsField,
  tags: ["ai-generated"],
  title: "Books/AuthorsField",
} satisfies Meta<typeof AuthorsField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await expect(input).toBeVisible();
    await userEvent.click(input);
    await expect(await surface.findByText("Авторів не знайдено.")).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const RecentAndAll: Story = {
  beforeEach: () => {
    mockAuthors({
      all: [{ id: "a1", name: "Тарас Шевченко" }],
      recent: [{ id: "r1", name: "Ліна Костенко" }],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);

    await expect(await surface.findByText("Раніше використані")).toBeInTheDocument();
    await expect(await surface.findByText("Усі автори")).toBeInTheDocument();
    await expect(await surface.findByText("Тарас Шевченко")).toBeInTheDocument();

    await userEvent.click(await surface.findByText("Ліна Костенко"));

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Ліна Костенко"),
    );
    await expect(
      canvas.getByRole("button", { name: "Видалити автора «Ліна Костенко»" }),
    ).toBeVisible();
  },
  render: () => <Harness />,
};

export const TypingCreatesCustom: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);
    await userEvent.type(input, "Невідомий Автор");

    await userEvent.click(await surface.findByText("Створити «Невідомий Автор»"));

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("custom:Невідомий Автор"),
    );
  },
  render: () => <Harness />,
};

export const HomonymousCatalogAuthors: Story = {
  beforeEach: () => {
    mockAuthors({
      recent: [
        { id: "a1", name: "John Williams" },
        { id: "a2", name: "John Williams" },
      ],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox");
    await userEvent.click(input);

    const option = await surface.findByRole("option", { name: "John Williams" });
    await userEvent.click(option);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent(
        "catalog:John Williams | catalog:John Williams",
      ),
    );
    await expect(
      canvas.getAllByRole("button", { name: "Видалити автора «John Williams»" }),
    ).toHaveLength(2);
  },
  render: () => <Harness initial={[{ id: "a1", kind: "catalog", name: "John Williams" }]} />,
};

export const InvalidCustomNameHasNoCreateItem: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);
    await userEvent.type(input, "Author <b>");

    await expect(await surface.findByText("Авторів не знайдено.")).toBeInTheDocument();
    await expect(surface.queryByText(/^Створити «/)).toBeNull();
  },
  render: () => <Harness />,
};

export const SeveralChipsSelected: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Видалити автора «Ліна Костенко»" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Видалити автора «Тарас Шевченко»" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Видалити автора «Власний Автор»" }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Видалити автора «Тарас Шевченко»" }));

    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Видалити автора «Тарас Шевченко»" })).toBeNull(),
    );
  },
  render: () => (
    <Harness
      initial={[
        { id: "a1", kind: "catalog", name: "Ліна Костенко" },
        { id: "a2", kind: "catalog", name: "Тарас Шевченко" },
        { kind: "custom", name: "Власний Автор" },
      ]}
    />
  ),
};
