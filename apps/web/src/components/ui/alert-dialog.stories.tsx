import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Trash2Icon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

const meta = {
  component: AlertDialog,
  tags: ["ai-generated"],
  title: "UI/AlertDialog",
} satisfies Meta<typeof AlertDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function DeleteBookAlert() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Видалити книгу</Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Видалити книгу?</AlertDialogTitle>
          <AlertDialogDescription>Цю дію неможливо буде скасувати.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Видалити</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const Default: Story = {
  render: () => <DeleteBookAlert />,
};

export const OpensAndTrapsFocus: Story = {
  render: () => <DeleteBookAlert />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Видалити книгу" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("alertdialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleName("Видалити книгу?");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  render: () => <DeleteBookAlert />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Видалити книгу" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("alertdialog");
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const CancelReturnsFocus: Story = {
  render: () => <DeleteBookAlert />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Видалити книгу" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    await surface.findByRole("alertdialog");

    const cancel = surface.getByRole("button", { name: "Скасувати" });
    await userEvent.click(cancel);

    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
