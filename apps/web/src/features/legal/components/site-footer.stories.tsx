import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { SiteFooter } from "./site-footer";

const meta = {
  component: SiteFooter,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Legal/SiteFooter",
} satisfies Meta<typeof SiteFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Конфіденційність" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Умови" })).toBeVisible();
    await expect(canvas.getByText(/BookNest/)).toBeVisible();
  },
};
