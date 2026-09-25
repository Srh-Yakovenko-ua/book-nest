import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { UiIcon } from "@/components/icons";

import { ChipGroup } from "./chip-group";

const OWNERSHIP_OPTIONS = [
  { icon: <UiIcon name="circle-slash" />, label: "Немає", value: "none" },
  { icon: <UiIcon name="bookmark" />, label: "Хочу", value: "want" },
  { icon: <UiIcon name="book" />, label: "Маю (не прочитано)", value: "owned" },
  { icon: <UiIcon name="check-circle" />, label: "Маю (прочитано)", value: "read" },
] as const;

const meta = {
  args: {
    mode: "single",
    onValueChange: () => {},
    options: OWNERSHIP_OPTIONS,
    value: "none",
  },
  component: ChipGroup,
  tags: ["ai-generated"],
  title: "UI/ChipGroup",
} satisfies Meta<typeof ChipGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

const GENRE_OPTIONS = [
  { label: "Фентезі", value: "fantasy" },
  { label: "Романтика", value: "romance" },
  { label: "Young Adult", value: "ya" },
  { label: "Детектив", value: "mystery" },
  { label: "Трилер", value: "thriller" },
  { label: "Нон-фікшн", value: "nonfiction" },
] as const;

function SingleExample() {
  const [value, setValue] = useState("none");
  return (
    <ChipGroup
      label="Статус володіння"
      mode="single"
      onValueChange={setValue}
      options={OWNERSHIP_OPTIONS}
      value={value}
    />
  );
}

export const Single: Story = {
  render: () => <SingleExample />,
};

function MultiExample() {
  const [value, setValue] = useState<string[]>(["fantasy", "ya"]);
  return (
    <ChipGroup
      label="Жанри"
      mode="multi"
      onValueChange={setValue}
      options={GENRE_OPTIONS}
      value={value}
    />
  );
}

export const Multi: Story = {
  render: () => (
    <div className="max-w-md">
      <MultiExample />
    </div>
  ),
};

export const MultiTogglesIndependently: Story = {
  render: () => <MultiExample />,
  play: async ({ canvas }) => {
    const fantasy = canvas.getByRole("button", { name: "Фентезі" });
    const romance = canvas.getByRole("button", { name: "Романтика" });
    await expect(fantasy).toHaveAttribute("aria-pressed", "true");
    await expect(romance).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(romance);
    await expect(romance).toHaveAttribute("aria-pressed", "true");
    await expect(fantasy).toHaveAttribute("aria-pressed", "true");
  },
};

const QUICK_FILTER_OPTIONS = [
  { count: 128, label: "Усі", value: "all" },
  { count: 42, label: "Читаю", value: "reading" },
  { count: 73, label: "Прочитані", value: "finished" },
  { count: 0, label: "У черзі", value: "queue" },
] as const;

function QuickFilterExample() {
  const [value, setValue] = useState("reading");
  return (
    <ChipGroup
      label="Швидкі фільтри"
      mode="single"
      onValueChange={setValue}
      options={QUICK_FILTER_OPTIONS}
      size="sm"
      value={value}
    />
  );
}

export const QuickFilterCounts: Story = {
  render: () => <QuickFilterExample />,
  play: async ({ canvas }) => {
    const empty = canvas.getByRole("radio", { name: "У черзі 0" });
    await expect(empty).toBeEnabled();
    await userEvent.click(empty);
    await expect(empty).toHaveAttribute("aria-checked", "true");
  },
};

function QuickFilterPendingExample() {
  const [value, setValue] = useState("reading");
  return (
    <ChipGroup
      countsPending
      label="Швидкі фільтри"
      mode="single"
      onValueChange={setValue}
      options={QUICK_FILTER_OPTIONS.map(({ label, value: optionValue }) => ({
        label,
        value: optionValue,
      }))}
      size="sm"
      value={value}
    />
  );
}

export const QuickFilterCountsPending: Story = {
  render: () => <QuickFilterPendingExample />,
  play: async ({ canvas }) => {
    const finished = canvas.getByRole("radio", { name: "Прочитані" });
    await expect(finished).toBeEnabled();
    await userEvent.click(finished);
    await expect(finished).toHaveAttribute("aria-checked", "true");
  },
};
