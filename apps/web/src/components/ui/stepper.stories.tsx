import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { Stepper } from "./stepper";

const STEPS = [
  { description: "Прочитано", label: "Тінь і кістка" },
  { description: "Читаю", label: "Облога і буря" },
  { description: "Не прочитано", label: "Руїна і відновлення" },
  { description: "Не прочитано", label: "Король шрамів" },
];

const meta = {
  args: {
    current: 1,
    steps: STEPS,
  },
  component: Stepper,
  tags: ["ai-generated"],
  title: "UI/Stepper",
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FourStepsAtStepTwo: Story = {
  args: { current: 1, steps: STEPS },
};

export const FirstStep: Story = {
  args: { current: 0, steps: STEPS },
};

export const AllDone: Story = {
  args: { current: 4, steps: STEPS },
};

export const PlainOrder: Story = {
  args: {
    current: 0,
    steps: [
      { label: "Тінь і кістка" },
      { label: "Облога і буря" },
      { label: "Руїна і відновлення" },
    ],
  },
};

export const CurrentStepHasAriaCurrent: Story = {
  args: { current: 1, steps: STEPS },
  play: async ({ canvas }) => {
    const current = canvas.getByText("Облога і буря").closest("[data-slot=step]");
    await expect(current).toHaveAttribute("aria-current", "step");
    const done = canvas.getByText("Тінь і кістка").closest("[data-slot=step]");
    await expect(done).not.toHaveAttribute("aria-current");
    await expect(done).toHaveAttribute("data-state", "done");
  },
};
