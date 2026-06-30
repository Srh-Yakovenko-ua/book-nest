import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { NumberStepper } from "./number-stepper";

const meta = {
  args: {
    onValueChange: () => {},
    value: 24,
  },
  component: NumberStepper,
  tags: ["ai-generated"],
  title: "UI/NumberStepper",
} satisfies Meta<typeof NumberStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

function Example({
  initial,
  max,
  min,
  step,
  suffix,
}: {
  initial: number;
  max?: number;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      ariaLabel="Кількість"
      max={max}
      min={min}
      onValueChange={setValue}
      step={step}
      suffix={suffix}
      value={value}
    />
  );
}

export const Default: Story = {
  render: () => <Example initial={24} min={0} suffix="стор." />,
};

export const Bounded: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Example initial={1} max={10} min={1} suffix="шт." />
      <Example initial={10} max={10} min={1} suffix="шт." />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Example initial={380} min={0} step={10} suffix="грн" />
      <div className="text-sm">
        <NumberStepper
          ariaLabel="Розмір"
          onValueChange={() => {}}
          size="sm"
          suffix="шт."
          value={3}
        />
      </div>
      <NumberStepper
        ariaLabel="Вимкнено"
        disabled
        onValueChange={() => {}}
        suffix="стор."
        value={12}
      />
    </div>
  ),
};

export const DisablesAtMax: Story = {
  render: () => <Example initial={9} max={10} min={0} />,
  play: async ({ canvas }) => {
    const increase = canvas.getByRole("button", { name: "Збільшити" });
    await expect(increase).toBeEnabled();
    await userEvent.click(increase);
    await expect(increase).toBeDisabled();
    const spinbutton = canvas.getByRole("spinbutton");
    await expect(spinbutton).toHaveValue("10");
  },
};
