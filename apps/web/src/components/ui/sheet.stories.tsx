import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta = {
  component: Sheet,
  tags: ["ai-generated"],
  title: "UI/Sheet",
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

function FiltersSheet({ side = "right" }: { side?: "bottom" | "left" | "right" | "top" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Фільтри</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Фільтри</SheetTitle>
          <SheetDescription>Звузь добірку книг за параметрами.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-5">
          <Label htmlFor="sheet-author">Автор</Label>
          <Input id="sheet-author" placeholder="Ім'я автора" />
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="ghost">Скинути</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Застосувати</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Right: Story = {
  render: () => <FiltersSheet side="right" />,
};

export const Left: Story = {
  render: () => <FiltersSheet side="left" />,
};

export const Bottom: Story = {
  render: () => <FiltersSheet side="bottom" />,
};

export const OpensAndTrapsFocus: Story = {
  render: () => <FiltersSheet />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Фільтри" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  render: () => <FiltersSheet />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Фільтри" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
