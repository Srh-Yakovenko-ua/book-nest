import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AuthLayout } from "./auth-layout";

const meta = {
  component: AuthLayout,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["ai-generated"],
  title: "Auth/AuthLayout",
} satisfies Meta<typeof AuthLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

const SampleForm = () => (
  <form className="flex flex-col gap-4">
    <div className="grid gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" placeholder="you@example.com" type="email" />
    </div>
    <div className="grid gap-1.5">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" />
    </div>
    <Button className="w-full" type="submit">
      Sign in
    </Button>
  </form>
);

export const Default: Story = {
  args: {
    children: <SampleForm />,
    cover: "/auth/cover-login.webp",
    tagline: "your cozy reading corner",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("main")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  },
};
