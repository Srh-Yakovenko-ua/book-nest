import type { DeliveryServiceView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";

import { DeliveryServiceAutocomplete } from "./delivery-service-autocomplete";

type DeliveryServiceSeed = { countryCode?: string; id: string; isCustom?: boolean; name: string };

function Harness() {
  const [value, setValue] = useState("");
  return (
    <div className="w-80">
      <DeliveryServiceAutocomplete
        id="delivery-service"
        invalid={false}
        label="Служба доставки"
        onChange={setValue}
        placeholder="Напр. Нова пошта"
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

function mockServices({
  recent = [],
  search = [],
}: {
  recent?: DeliveryServiceSeed[];
  search?: DeliveryServiceSeed[];
}) {
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/delivery-services/recent")) {
      return Promise.resolve(jsonResponse(200, recent.map(toServiceView)));
    }
    return Promise.resolve(
      jsonResponse(200, {
        items: search.map(toServiceView),
        page: 1,
        pagesCount: 1,
        pageSize: 20,
        totalCount: search.length,
      }),
    );
  }) as typeof fetch;
}

function toServiceView(item: DeliveryServiceSeed): DeliveryServiceView {
  return {
    countryCode: item.countryCode ?? null,
    id: item.id,
    isCustom: item.isCustom ?? false,
    name: item.name,
  };
}

const meta = {
  args: {
    id: "delivery-service",
    invalid: false,
    label: "Служба доставки",
    onChange: () => undefined,
    placeholder: "Напр. Нова пошта",
    value: "",
  },
  beforeEach: () => {
    mockServices({});
  },
  component: DeliveryServiceAutocomplete,
  tags: ["ai-generated"],
  title: "Books/DeliveryServiceAutocomplete",
} satisfies Meta<typeof DeliveryServiceAutocomplete>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OpensOnClickShowsRecent: Story = {
  beforeEach: () => {
    mockServices({
      recent: [
        { id: "r1", name: "Нова Пошта" },
        { id: "r2", name: "Укрпошта" },
      ],
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Служба доставки" });
    await userEvent.click(input);

    await waitFor(() => expect(surface.getByText("Раніше використані")).toBeVisible());
    await expect(surface.getByText("Укрпошта")).toBeVisible();

    await userEvent.click(surface.getByText("Нова Пошта"));
    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("Нова Пошта"));
  },
  render: () => <Harness />,
};

export const PickFromCatalog: Story = {
  play: async ({ canvas }) => {
    mockServices({
      search: [{ countryCode: "UA", id: "s1", name: "Нова Пошта" }],
    });
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Служба доставки" });
    await userEvent.click(input);
    await userEvent.type(input, "пошта");

    const option = await surface.findByText("Нова Пошта");
    await userEvent.click(option);

    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("Нова Пошта"));
  },
  render: () => <Harness />,
};

export const CreateFromTyped: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const input = canvas.getByRole("combobox", { name: "Служба доставки" });
    await userEvent.click(input);
    await userEvent.type(input, "Кур'єр Плюс");

    const create = await surface.findByText(/Створити/);
    await userEvent.click(create);

    await waitFor(() => expect(canvas.getByTestId("value")).toHaveTextContent("Кур'єр Плюс"));
  },
  render: () => <Harness />,
};

export const AccessibleName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Служба доставки" })).toBeVisible();
  },
  render: () => <Harness />,
};
