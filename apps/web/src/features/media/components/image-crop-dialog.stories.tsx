import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ImageCropDialog } from "./image-crop-dialog";

const COVER_ASPECT = 2 / 3;

function CropExample() {
  const [file] = useState(makeCoverFile);
  const [open, setOpen] = useState(true);
  const [croppedLabel, setCroppedLabel] = useState<null | string>(null);

  return (
    <div className="w-[420px]">
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={file}
        onCropped={({ crop, file: cropped }) =>
          setCroppedLabel(`${cropped.name} · ${crop.width}×${crop.height}`)
        }
        onOpenChange={setOpen}
        open={open}
      />
      {croppedLabel === null ? null : <p data-slot="cropped-result">{croppedLabel}</p>}
    </div>
  );
}

function dataUrlToFile(dataUrl: string, name: string) {
  const parts = dataUrl.split(",");
  const header = parts[0] ?? "";
  const encoded = parts[1] ?? "";
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], name, { type: mime });
}

function makeCoverFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#a96e47";
    context.fillRect(0, 0, 400, 600);
    context.fillStyle = "#f2e7dc";
    context.fillRect(40, 60, 320, 120);
  }
  return dataUrlToFile(canvas.toDataURL("image/png"), "cover.png");
}

const meta = {
  args: {
    aspect: COVER_ASPECT,
    file: null,
    onCropped: () => {},
    onOpenChange: () => {},
    open: false,
  },
  component: ImageCropDialog,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Media/ImageCropDialog",
} satisfies Meta<typeof ImageCropDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const surface = within(document.body);
    const dialog = await surface.findByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Обрізати обкладинку");
    await expect(surface.getByLabelText("Масштаб")).toBeVisible();
    await expect(surface.getByRole("button", { name: "Застосувати" })).toBeVisible();
    await expect(surface.getByRole("button", { name: "Скасувати" })).toBeVisible();
  },
  render: () => <CropExample />,
};

export const CropRegionIsNamedAndFocusable: Story = {
  play: async () => {
    const surface = within(document.body);
    await surface.findByRole("dialog");

    const region = await surface.findByRole("group", { name: "Область обрізання обкладинки" });
    await expect(region).toHaveAttribute("tabindex", "0");
    region.focus();
    await expect(region).toHaveFocus();
  },
  render: () => <CropExample />,
};

export const AppliesCrop: Story = {
  play: async () => {
    const surface = within(document.body);
    await surface.findByRole("dialog");

    const apply = surface.getByRole("button", { name: "Застосувати" });
    await waitFor(() => expect(apply).toBeEnabled(), { timeout: 5000 });
    await userEvent.click(apply);

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(await surface.findByText(/cover\.png/)).toBeVisible();
  },
  render: () => <CropExample />,
};

export const Cancels: Story = {
  play: async () => {
    const surface = within(document.body);
    await surface.findByRole("dialog");

    await userEvent.click(surface.getByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
  },
  render: () => <CropExample />,
};
