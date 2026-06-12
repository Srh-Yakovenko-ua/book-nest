import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { UiIcon } from "@/components/icons";

import { Segmented } from "./segmented";

const TYPE_OPTIONS = [
  { label: "Соло книга", value: "solo" },
  { label: "Частина серії", value: "series" },
] as const;

const meta = {
  args: {
    onValueChange: () => {},
    options: TYPE_OPTIONS,
    value: "series",
  },
  component: Segmented,
  tags: ["ai-generated"],
  title: "UI/Segmented",
} satisfies Meta<typeof Segmented>;

export default meta;

type Story = StoryObj<typeof meta>;

const LIBRARY_OPTIONS = [
  { label: "Усі", value: "all" },
  { label: "Читаю", value: "reading" },
  { label: "Прочитані", value: "finished" },
] as const;

function TwoOption() {
  const [value, setValue] = useState("series");
  return <Segmented onValueChange={setValue} options={TYPE_OPTIONS} value={value} />;
}

export const Default: Story = {
  render: () => <TwoOption />,
};

function ThreeOption() {
  const [value, setValue] = useState("all");
  return <Segmented block onValueChange={setValue} options={LIBRARY_OPTIONS} value={value} />;
}

export const ThreeOptions: Story = {
  render: () => (
    <div className="w-80">
      <ThreeOption />
    </div>
  ),
};

function WithIcons() {
  const [value, setValue] = useState("grid");
  return (
    <Segmented
      onValueChange={setValue}
      options={[
        { icon: <UiIcon name="layers" />, label: "Сітка", value: "grid" },
        { icon: <UiIcon name="list" />, label: "Список", value: "list" },
      ]}
      value={value}
    />
  );
}

export const WithIconsAndAccent: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <WithIcons />
      <AccentExample />
    </div>
  ),
};

function AccentExample() {
  const [value, setValue] = useState("ongoing");
  return (
    <Segmented
      onValueChange={setValue}
      options={[
        { label: "Завершена", value: "completed" },
        { label: "Ще виходить", value: "ongoing" },
      ]}
      tone="accent"
      value={value}
    />
  );
}

export const SelectionChanges: Story = {
  render: () => <TwoOption />,
  play: async ({ canvas }) => {
    const solo = canvas.getByRole("radio", { name: "Соло книга" });
    const series = canvas.getByRole("radio", { name: "Частина серії" });
    await expect(series).toHaveAttribute("aria-checked", "true");
    await userEvent.click(solo);
    await expect(solo).toHaveAttribute("aria-checked", "true");
    await expect(series).toHaveAttribute("aria-checked", "false");
  },
};
