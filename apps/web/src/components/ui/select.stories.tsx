import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

const GENRES = [
  { label: "Фентезі", value: "fantasy" },
  { label: "Романтика", value: "romance" },
  { label: "Детектив", value: "mystery" },
  { label: "Трилер", value: "thriller" },
];

const meta = {
  component: Select,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/Select",
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

function GenrePicker({
  initial = "",
  clearable = false,
}: {
  clearable?: boolean;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Select onValueChange={setValue} value={value}>
      <SelectTrigger
        className="w-full"
        isClearable={clearable}
        onClear={clearable ? () => setValue("") : undefined}
      >
        <SelectValue placeholder="Оберіть жанр" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Жанри</SelectLabel>
          {GENRES.map((genre) => (
            <SelectItem key={genre.value} value={genre.value}>
              {genre.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export const Default: Story = {
  render: () => <GenrePicker />,
};

export const Clearable: Story = {
  render: () => <GenrePicker clearable initial="fantasy" />,
  play: async ({ canvas }) => {
    const clear = canvas.getByRole("button", { name: "Clear" });
    await expect(clear).toBeVisible();

    clear.focus();
    await expect(clear).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    const trigger = canvas.getByRole("combobox");
    await expect(within(trigger).getByText("Оберіть жанр")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  },
};
