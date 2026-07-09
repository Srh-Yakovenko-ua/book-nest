import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  component: Dialog,
  tags: ["ai-generated"],
  title: "UI/Dialog",
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function CreateListDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Створити список</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Створити список</DialogTitle>
          <DialogDescription>Коротка назва, видима лише тобі.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="list-name">Назва списку</Label>
          <Input id="list-name" placeholder="Напр. «Літо 2026»" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Скасувати</Button>
          </DialogClose>
          <Button>Створити</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Default: Story = {
  render: () => <CreateListDialog />,
};

export const OpensWithoutAutoFocusThenTrapsFocus: Story = {
  render: () => <CreateListDialog />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Створити список" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleName("Створити список");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(false));

    await userEvent.tab();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  render: () => <CreateListDialog />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Створити список" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const CloseButtonReturnsFocus: Story = {
  render: () => <CreateListDialog />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Створити список" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    await surface.findByRole("dialog");

    const cancel = surface.getByRole("button", { name: "Скасувати" });
    await userEvent.click(cancel);

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
