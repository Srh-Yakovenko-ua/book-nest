import type { PublisherView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { type PublisherSelection } from "../model/create-book-form";
import { PublisherAutocomplete } from "./publisher-autocomplete";

type PublisherSeed = { id: string; isCustom?: boolean; name: string };

function Harness() {
  const [value, setValue] = useState<null | PublisherSelection>(null);
  return (
    <div className="w-80">
      <PublisherAutocomplete
        id="publisher"
        invalid={false}
        label="Видавництво"
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

function mockPublishers({
  recent = [],
  search = [],
}: {
  recent?: PublisherSeed[];
  search?: PublisherSeed[];
}) {
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/publishers/recent")) {
      return Promise.resolve(jsonResponse(200, recent.map(toPublisherView)));
    }
    return Promise.resolve(
      jsonResponse(200, {
        items: search.map(toPublisherView),
        page: 1,
        pagesCount: 1,
        pageSize: 20,
        totalCount: search.length,
      }),
    );
  }) as typeof fetch;
}

function toPublisherView(item: PublisherSeed): PublisherView {
  return {
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
  };
}

const meta = {
  args: {
    id: "publisher",
    invalid: false,
    label: "Видавництво",
    onChange: () => undefined,
    placeholder: "Почніть вводити назву видавництва…",
    value: null,
  },
  beforeEach: () => {
    mockPublishers({});
  },
  component: PublisherAutocomplete,
  tags: ["ai-generated"],
  title: "Books/PublisherAutocomplete",
} satisfies Meta<typeof PublisherAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PickFromCatalog: Story = {
  play: async ({ canvas }) => {
    mockPublishers({
      search: [{ id: "22222222-2222-2222-2222-222222222222", name: "Видавництво Старого Лева" }],
    });
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

export const OpensOnClickShowsRecent: Story = {
  beforeEach: () => {
    mockPublishers({
      recent: [
        { id: "r1", name: "Видавництво Старого Лева" },
        { id: "r2", name: "Наш Формат" },
      ],
      search: [
        { id: "r1", name: "Видавництво Старого Лева" },
        { id: "s1", name: "Ранок" },
      ],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Видавництво" });
    await userEvent.click(input);

    await waitFor(() => expect(surface.getByText("Раніше використані")).toBeVisible());
    await expect(surface.getByText("Усі видавництва")).toBeVisible();
    await expect(surface.getByText("Наш Формат")).toBeVisible();
    await expect(surface.getByText("Ранок")).toBeVisible();
    await waitFor(() => expect(surface.getAllByText("Видавництво Старого Лева")).toHaveLength(1));

    await userEvent.click(surface.getByText("Наш Формат"));
    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Наш Формат"),
    );
  },
  render: () => <Harness />,
};

export const CreateCustom: Story = {
  play: async ({ canvas }) => {
    mockPublishers({});
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

export const AccessibleName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Видавництво" })).toBeVisible();
  },
  render: () => <Harness />,
};

export const KeyboardSelect: Story = {
  play: async ({ canvas }) => {
    mockPublishers({
      search: [
        { id: "22222222-2222-2222-2222-222222222222", name: "Видавництво Старого Лева" },
        { id: "33333333-3333-3333-3333-333333333333", name: "Видавництво Ранок" },
      ],
    });
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Видавництво" });
    await userEvent.click(input);
    await userEvent.type(input, "Видавництво Старого Лева");

    await waitFor(() => expect(surface.getByText("Видавництво Ранок")).toBeVisible());
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent("catalog:Видавництво Ранок"),
    );
  },
  render: () => <Harness />,
};
