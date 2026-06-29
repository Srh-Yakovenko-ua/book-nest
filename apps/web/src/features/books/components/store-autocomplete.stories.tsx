import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { StoreAutocomplete } from "./store-autocomplete";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <div className="w-80">
      <StoreAutocomplete
        id="store"
        invalid={false}
        label="Магазин"
        onChange={setValue}
        placeholder="Напр. Yakaboo"
        value={value}
      />
      <p data-testid="value">{value === "" ? "empty" : value}</p>
    </div>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockStores(stores: string[]) {
  getQueryClient().clear();
  globalThis.fetch = (() => Promise.resolve(jsonResponse(200, stores))) as typeof fetch;
}

const meta = {
  args: {
    id: "store",
    invalid: false,
    label: "Магазин",
    onChange: () => undefined,
    placeholder: "Напр. Yakaboo",
    value: "",
  },
  beforeEach: () => {
    mockStores([]);
  },
  component: StoreAutocomplete,
  tags: ["ai-generated"],
  title: "Books/StoreAutocomplete",
} satisfies Meta<typeof StoreAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PickRecent: Story = {
  beforeEach: () => {
    mockStores(["Yakaboo", "Bookstore"]);
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Магазин" });
    await userEvent.click(input);

    await waitFor(() => expect(surface.getByText("Раніше використані")).toBeVisible());
    await expect(surface.getByText("Bookstore")).toBeVisible();

    await userEvent.click(surface.getByText("Yakaboo"));
    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("Yakaboo"));
  },
  render: () => <Harness />,
};

export const CreateFromTyped: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Магазин" });
    await userEvent.click(input);
    await userEvent.type(input, "Нова Книгарня");

    const create = await surface.findByText(/Створити/);
    await userEvent.click(create);

    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("Нова Книгарня"));
  },
  render: () => <Harness />,
};

export const FiltersRecentByInput: Story = {
  beforeEach: () => {
    mockStores(["Yakaboo", "Bookstore"]);
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Магазин" });
    await userEvent.click(input);
    await userEvent.type(input, "yak");

    await waitFor(() => expect(surface.getByText("Yakaboo")).toBeVisible());
    await expect(surface.queryByText("Bookstore")).toBeNull();
  },
  render: () => <Harness />,
};
