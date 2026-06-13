import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { FormSection } from "./form-section";

const meta = {
  args: {
    children: <p className="text-sm text-muted-foreground">Вміст секції форми.</p>,
    description: "Назва й автор — це все, що потрібно для початку.",
    icon: "book",
    title: "Основна інформація",
  },
  component: FormSection,
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "Books/FormSection",
} satisfies Meta<typeof FormSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Основна інформація" })).toBeVisible();
    await expect(canvas.getByText("Вміст секції форми.")).toBeVisible();
  },
};
