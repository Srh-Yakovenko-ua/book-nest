import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { type PublisherSelection } from "../model/create-book-form";
import { PublisherAutocomplete } from "./publisher-autocomplete";

function Harness() {
  const [value, setValue] = useState<null | PublisherSelection>(null);
  return (
    <div className="w-80">
      <PublisherAutocomplete
        id="publisher"
        invalid={false}
        onChange={setValue}
        placeholder="Почніть вводити назву видавництва…"
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

function mockPublisherSearch(items: { id: string; isCustom?: boolean; name: string }[]) {
  globalThis.fetch = (() =>
    Promise.resolve(
      jsonResponse(200, {
        items: items.map((item) => ({
          countryCode: null,
          foundedYear: null,
          id: item.id,
          isCustom: item.isCustom ?? false,
          logoAttribution: null,
          logoLicense: null,
          logoLicenseUrl: null,
          logoUrl: null,
          name: item.name,
          websiteUrl: null,
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
    id: "publisher",
    invalid: false,
    onChange: () => undefined,
    placeholder: "Почніть вводити назву видавництва…",
    value: null,
  },
  component: PublisherAutocomplete,
  tags: ["ai-generated"],
  title: "Books/PublisherAutocomplete",
} satisfies Meta<typeof PublisherAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PickFromCatalog: Story = {
  play: async ({ canvas }) => {
    mockPublisherSearch([
      { id: "22222222-2222-2222-2222-222222222222", name: "Видавництво Старого Лева" },
    ]);
    const surface = within(document.body);

    const input = canvas.getByPlaceholderText("Почніть вводити назву видавництва…");
    await userEvent.click(input);
    await userEvent.type(input, "Старого");

    const option = await surface.findByText("Видавництво Старого Лева");
    await userEvent.click(option);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Видавництво Старого Лева"),
    );
  },
  render: () => <Harness />,
};

export const CreateCustom: Story = {
  play: async ({ canvas }) => {
    mockPublisherSearch([]);
    const surface = within(document.body);

    const input = canvas.getByPlaceholderText("Почніть вводити назву видавництва…");
    await userEvent.click(input);
    await userEvent.type(input, "Невідоме Видавництво");

    const custom = await surface.findByText(/Використати/);
    await userEvent.click(custom);

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("custom:Невідоме Видавництво"),
    );
  },
  render: () => <Harness />,
};
