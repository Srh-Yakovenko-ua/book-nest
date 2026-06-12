import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta = {
  component: HoverCard,
  tags: ["ai-generated"],
  title: "UI/HoverCard",
} satisfies Meta<typeof HoverCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function AuthorHoverCard() {
  return (
    <HoverCard closeDelay={0} openDelay={0}>
      <HoverCardTrigger asChild>
        <Button variant="link">Емілі Бронте</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="font-heading font-semibold text-ink">Емілі Бронте</p>
        <p className="text-muted-foreground">
          Англійська письменниця й поетеса, авторка «Грозового перевалу».
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const Default: Story = {
  render: () => <AuthorHoverCard />,
};

export const AppearsOnHover: Story = {
  render: () => <AuthorHoverCard />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Емілі Бронте" });
    await userEvent.hover(trigger);

    const surface = within(document.body);
    await waitFor(async () => {
      await expect(await surface.findByText(/Англійська письменниця/)).toBeVisible();
    });
  },
};

export const AppearsOnFocus: Story = {
  render: () => <AuthorHoverCard />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Емілі Бронте" });
    trigger.focus();
    await expect(trigger).toHaveFocus();

    const surface = within(document.body);
    await waitFor(async () => {
      await expect(await surface.findByText(/Англійська письменниця/)).toBeVisible();
    });
  },
};
