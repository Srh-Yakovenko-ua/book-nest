import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ImageViewerDialog } from "./image-viewer-dialog";

function makeCoverDataUrl(fill: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, 400, 600);
  }
  return canvas.toDataURL("image/png");
}

function ViewerExample({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className="w-[420px]">
      <button onClick={() => setOpen(true)} type="button">
        Open viewer
      </button>
      <ImageViewerDialog
        alt="Sample cover"
        caption="cover.webp · 1066 × 1600"
        onOpenChange={setOpen}
        open={open}
        src={makeCoverDataUrl("#a96e47")}
        title="Book cover"
      />
    </div>
  );
}

function ViewerWithActions() {
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="w-[420px]">
      <ImageViewerDialog
        alt="Sample cover"
        deleteLabel="Delete"
        onDelete={() => setLog((entries) => [...entries, "delete"])}
        onOpenChange={setOpen}
        onReplace={() => setLog((entries) => [...entries, "replace"])}
        open={open}
        replaceLabel="Replace"
        src={makeCoverDataUrl("#a96e47")}
        title="Book cover"
      />
      <p data-slot="action-log">{log.join(",")}</p>
    </div>
  );
}

const meta = {
  args: {
    alt: "Sample cover",
    onOpenChange: () => {},
    open: false,
    src: "",
  },
  component: ImageViewerDialog,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Media/ImageViewerDialog",
} satisfies Meta<typeof ImageViewerDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Book cover");
    await waitFor(() => expect(surface.getByRole("img", { name: "Sample cover" })).toBeVisible());
    await expect(surface.getByText("cover.webp · 1066 × 1600")).toBeVisible();
  },
  render: () => <ViewerExample initialOpen />,
};

export const EscapeClosesAndRestoresFocus: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const opener = canvas.getByRole("button", { name: "Open viewer" });
    opener.focus();
    await userEvent.click(opener);

    await surface.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  },
  render: () => <ViewerExample initialOpen={false} />,
};

export const WithReplaceAndDeleteActions: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const dialog = within(await surface.findByRole("dialog"));

    const replace = dialog.getByRole("button", { name: "Replace" });
    const remove = dialog.getByRole("button", { name: "Delete" });
    await waitFor(() => expect(replace).toBeVisible());
    await waitFor(() => expect(remove).toBeVisible());

    await userEvent.click(replace);
    await userEvent.click(remove);

    await waitFor(() => expect(canvas.getByText("replace,delete")).toBeVisible());
  },
  render: () => <ViewerWithActions />,
};
