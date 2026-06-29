import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { type AuthorSelection } from "../model/create-book-form";
import { AuthorAutocomplete } from "./author-autocomplete";

function Harness() {
  const [value, setValue] = useState<AuthorSelection | null>(null);
  return (
    <div className="w-80">
      <AuthorAutocomplete
        id="author"
        invalid={false}
        label="Автор"
        onChange={setValue}
        placeholder="Почніть вводити імʼя автора…"
        value={value}
      />
      <p data-testid="selection">{value === null ? "none" : `${value.kind}:${value.name}`}</p>
    </div>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockAuthorSearch(items: { id: string; isCustom?: boolean; name: string }[]) {
  globalThis.fetch = (() =>
    Promise.resolve(
      jsonResponse(200, {
        items: items.map((item) => ({
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
        })),
        page: 1,
        pagesCount: 1,
        pageSize: 8,
        totalCount: items.length,
      }),
    )) as typeof fetch;
}

const meta = {
  args: {
    id: "author",
    invalid: false,
    label: "Автор",
    onChange: () => undefined,
    placeholder: "Почніть вводити імʼя автора…",
    value: null,
  },
  component: AuthorAutocomplete,
  tags: ["ai-generated"],
  title: "Books/AuthorAutocomplete",
} satisfies Meta<typeof AuthorAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PickFromCatalog: Story = {
  play: async ({ canvas }) => {
    mockAuthorSearch([
      { id: "11111111-1111-1111-1111-111111111111", name: "Михайло Коцюбинський" },
    ]);
    const surface = within(document.body);

    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);
    await userEvent.type(input, "Коцюб");

    const option = await surface.findByText("Михайло Коцюбинський");
    await userEvent.click(option);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Михайло Коцюбинський"),
    );
  },
  render: () => <Harness />,
};

export const CreateCustom: Story = {
  play: async ({ canvas }) => {
    mockAuthorSearch([]);
    const surface = within(document.body);

    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);
    await userEvent.type(input, "Невідомий Автор");

    const custom = await surface.findByText(/Використати/);
    await userEvent.click(custom);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("custom:Невідомий Автор"),
    );
  },
  render: () => <Harness />,
};

export const ClearSelection: Story = {
  play: async ({ canvas }) => {
    mockAuthorSearch([
      { id: "11111111-1111-1111-1111-111111111111", name: "Михайло Коцюбинський" },
    ]);
    const surface = within(document.body);

    const input = canvas.getByPlaceholderText("Почніть вводити імʼя автора…");
    await userEvent.click(input);
    await userEvent.type(input, "Коцюб");

    const option = await surface.findByText("Михайло Коцюбинський");
    await userEvent.click(option);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Михайло Коцюбинський"),
    );

    const clear = canvas.getByRole("button", { name: "Очистити" });
    await expect(clear).toBeVisible();
    await userEvent.click(clear);

    await waitFor(() => expect(canvas.getByTestId("selection")).toHaveTextContent("none"));
    await expect(input).toHaveValue("");
    await expect(canvas.queryByRole("button", { name: "Очистити" })).toBeNull();
  },
  render: () => <Harness />,
};

export const AccessibleName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Автор" })).toBeVisible();
  },
  render: () => <Harness />,
};

export const KeyboardSelect: Story = {
  play: async ({ canvas }) => {
    mockAuthorSearch([
      { id: "11111111-1111-1111-1111-111111111111", name: "Михайло Коцюбинський" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Михайло Старицький" },
    ]);
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Автор" });
    await userEvent.click(input);
    await userEvent.type(input, "Михайло Коцюбинський");

    await waitFor(() => expect(surface.getByText("Михайло Старицький")).toBeVisible());
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Михайло Старицький"),
    );
  },
  render: () => <Harness />,
};
