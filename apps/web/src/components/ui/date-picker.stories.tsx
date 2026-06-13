import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { DatePicker } from "./date-picker";

const CURRENT_YEAR = new Date().getFullYear();

const meta = {
  component: DatePicker,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/DatePicker",
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

function BirthdayPicker({ initial, invalid = false }: { initial?: Date; invalid?: boolean }) {
  const [value, setValue] = useState<Date | undefined>(initial);
  return (
    <DatePicker
      defaultMonth={new Date(CURRENT_YEAR - 25, 0)}
      endMonth={new Date()}
      id="story-dob"
      invalid={invalid}
      onChange={setValue}
      startMonth={new Date(CURRENT_YEAR - 120, 0, 1)}
      value={value}
    />
  );
}

export const Empty: Story = {
  args: {
    id: "story-dob",
    onChange: () => undefined,
  },
  render: () => <BirthdayPicker />,
};

export const Prefilled: Story = {
  args: {
    id: "story-dob",
    onChange: () => undefined,
  },
  render: () => <BirthdayPicker initial={new Date(1995, 5, 15)} />,
};

export const Invalid: Story = {
  args: {
    id: "story-dob",
    onChange: () => undefined,
  },
  render: () => <BirthdayPicker initial={new Date(CURRENT_YEAR - 5, 0, 1)} invalid />,
};

export const OpensAndSelects: Story = {
  args: {
    id: "story-dob",
    onChange: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Оберіть дату народження" });

    await userEvent.click(trigger);

    const body = within(document.body);

    await waitFor(() => {
      expect(body.getByRole("grid")).toBeInTheDocument();
    });

    expect(body.getByRole("combobox", { name: "Місяць" })).toBeInTheDocument();
    expect(body.getByRole("combobox", { name: "Рік" })).toBeInTheDocument();
  },
  render: () => <BirthdayPicker />,
};
