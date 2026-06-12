import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Multiselect, type MultiselectOption } from "./multiselect";

const GENRES: MultiselectOption[] = [
  { label: "Фентезі", value: "fantasy" },
  { label: "Романтика", value: "romance" },
  { label: "Детектив", value: "mystery" },
  { label: "Трилер", value: "thriller" },
  { label: "Наукова фантастика", value: "scifi" },
  { label: "Нон-фікшн", value: "nonfiction" },
  { label: "Young Adult", value: "ya" },
];

const meta = {
  args: {
    onValueChange: () => {},
    options: GENRES,
    value: [],
  },
  component: Multiselect,
  tags: ["ai-generated"],
  title: "UI/Multiselect",
} satisfies Meta<typeof Multiselect>;

export default meta;

type Story = StoryObj<typeof meta>;

function Example({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="max-w-md">
      <Multiselect
        onValueChange={setValue}
        options={GENRES}
        placeholder="Оберіть жанри"
        value={value}
      />
    </div>
  );
}

export const Empty: Story = {
  render: () => <Example initial={[]} />,
};

export const WithSelections: Story = {
  render: () => <Example initial={["fantasy", "ya"]} />,
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-md">
      <Multiselect disabled onValueChange={() => {}} options={GENRES} value={["fantasy"]} />
    </div>
  ),
};

export const OpenWithSelections: Story = {
  render: () => <Example initial={["fantasy"]} />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Оберіть жанри" });
    await userEvent.click(trigger);
    const popover = within(document.body);
    const romance = await popover.findByText("Романтика");
    await userEvent.click(romance);
    await expect(canvas.getByText("Романтика")).toBeInTheDocument();
  },
};

export const TypeToFilterOnOpen: Story = {
  render: () => <Example initial={[]} />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Оберіть жанри" });
    await userEvent.click(trigger);

    const popover = within(document.body);
    const search = await popover.findByPlaceholderText("Пошук…");
    await waitFor(() => expect(search).toHaveFocus());

    await userEvent.keyboard("детек");
    await expect(search).toHaveValue("детек");
    await expect(popover.getByText("Детектив")).toBeInTheDocument();
    await expect(popover.queryByText("Романтика")).not.toBeInTheDocument();
  },
};
