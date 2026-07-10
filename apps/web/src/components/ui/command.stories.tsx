import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

const meta = {
  component: Command,
  tags: ["ai-generated"],
  title: "UI/Command",
} satisfies Meta<typeof Command>;

export default meta;

type Story = StoryObj<typeof meta>;

function BookCommand() {
  return (
    <Command className="w-80 border border-border shadow-pop">
      <CommandInput placeholder="Пошук книги…" />
      <CommandList>
        <CommandEmpty>Нічого не знайдено.</CommandEmpty>
        <CommandGroup heading="Книги">
          <CommandItem>Грозовий перевал</CommandItem>
          <CommandItem>Джейн Ейр</CommandItem>
          <CommandItem>Місто</CommandItem>
          <CommandItem>Тіні забутих предків</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export const Default: Story = {
  render: () => <BookCommand />,
};

export const TypingFilters: Story = {
  render: () => <BookCommand />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Джейн Ейр")).toBeVisible();

    const input = canvas.getByPlaceholderText("Пошук книги…");
    await userEvent.click(input);
    await userEvent.keyboard("джейн");

    await waitFor(() => expect(canvas.queryByText("Грозовий перевал")).not.toBeInTheDocument());
    await expect(canvas.getByText("Джейн Ейр")).toBeVisible();
  },
};

function CommandPalette() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Відкрити палітру
      </Button>
      <CommandDialog onOpenChange={setOpen} open={open}>
        <Command>
          <CommandInput placeholder="Команда чи книга…" />
          <CommandList>
            <CommandEmpty>Нічого не знайдено.</CommandEmpty>
            <CommandGroup heading="Дії">
              <CommandItem>Додати книгу</CommandItem>
              <CommandItem>Створити список</CommandItem>
              <CommandItem>Імпортувати бібліотеку</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

export const Palette: Story = {
  render: () => <CommandPalette />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Відкрити палітру" });
    await userEvent.click(trigger);

    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    const input = surface.getByPlaceholderText("Команда чи книга…");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard("список");

    await waitFor(() => expect(surface.queryByText("Додати книгу")).not.toBeInTheDocument());
    await expect(surface.getByText("Створити список")).toBeVisible();
  },
};
