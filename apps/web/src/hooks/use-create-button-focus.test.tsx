import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { useCreateButtonFocus } from "./use-create-button-focus";

type Layout = "empty" | "filled";

async function closeDialogFromEmptyState() {
  await userEvent.click(emptyCreateButton());
  await screen.findByRole("dialog");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(emptyCreateButton()).toHaveFocus());
}

function CreateFocusProbe({ layout }: { layout: Layout }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { createButtonRef, focusCreateButtonOnClose } = useCreateButtonFocus();
  const openDialog = () => setIsDialogOpen(true);

  return (
    <>
      <input aria-label="Search" />
      {layout === "filled" && (
        <button onClick={openDialog} ref={createButtonRef} type="button">
          Header create
        </button>
      )}
      {layout === "empty" && (
        <button onClick={openDialog} ref={createButtonRef} type="button">
          Empty create
        </button>
      )}
      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent onCloseAutoFocus={focusCreateButtonOnClose}>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Name the new item.</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

function emptyCreateButton() {
  return screen.getByRole("button", { name: "Empty create" });
}

function headerCreateButton() {
  return screen.getByRole("button", { name: "Header create" });
}

describe("useCreateButtonFocus", () => {
  it("focuses the create button mounted at close time, not the one that opened the dialog", async () => {
    const { rerender } = renderWithProviders(<CreateFocusProbe layout="empty" />);

    await userEvent.click(emptyCreateButton());
    await screen.findByRole("dialog");
    rerender(<CreateFocusProbe layout="filled" />);
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(headerCreateButton()).toHaveFocus());
  });

  it("hands focus to the header button when it replaces the empty state after a dialog closed", async () => {
    const { rerender } = renderWithProviders(<CreateFocusProbe layout="empty" />);
    await closeDialogFromEmptyState();

    rerender(<CreateFocusProbe layout="filled" />);

    expect(headerCreateButton()).toHaveFocus();
  });

  it("leaves focus alone when the header button mounts before any dialog closed", () => {
    const { rerender } = renderWithProviders(<CreateFocusProbe layout="empty" />);

    rerender(<CreateFocusProbe layout="filled" />);

    expect(headerCreateButton()).not.toHaveFocus();
  });

  it("keeps focus on the field the reader moved to before the header button mounts", async () => {
    const { rerender } = renderWithProviders(<CreateFocusProbe layout="empty" />);
    await closeDialogFromEmptyState();
    await userEvent.click(screen.getByRole("textbox", { name: "Search" }));

    rerender(<CreateFocusProbe layout="filled" />);

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
  });
});
