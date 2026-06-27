import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { ImageCropDialog } from "./image-crop-dialog";

vi.mock("@/features/media/lib/crop-image", () => ({
  CropImageError: class CropImageError extends Error {},
  cropImageToFile: vi.fn(() =>
    Promise.resolve(new File(["cropped"], "cover.webp", { type: "image/webp" })),
  ),
}));

vi.mock("react-easy-crop", () => ({
  default: ({
    onCropComplete,
  }: {
    onCropComplete: (
      area: { height: number; width: number; x: number; y: number },
      areaPixels: { height: number; width: number; x: number; y: number },
    ) => void;
  }) => (
    <button
      onClick={() =>
        onCropComplete(
          { height: 150, width: 100, x: 0, y: 0 },
          { height: 150, width: 100, x: 0, y: 0 },
        )
      }
      type="button"
    >
      complete crop
    </button>
  ),
}));

const COVER_ASPECT = 3 / 4;

function sourceFile() {
  return new File(["source"], "source.png", { type: "image/png" });
}

describe("ImageCropDialog", () => {
  it("shows the title, zoom control, and actions when open", async () => {
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={sourceFile()}
        onCropped={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Обрізати обкладинку")).toBeInTheDocument();
    expect(screen.getByLabelText("Масштаб")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Застосувати" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={null}
        onCropped={vi.fn()}
        onOpenChange={vi.fn()}
        open={false}
      />,
    );

    expect(screen.queryByText("Обрізати обкладинку")).not.toBeInTheDocument();
  });

  it("exposes a bounded, labeled zoom slider", async () => {
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={sourceFile()}
        onCropped={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );

    const slider = await screen.findByRole("slider", { name: "Масштаб" });
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "3");
    expect(slider).toHaveAttribute("step", "0.05");
  });

  it("closes via Cancel without cropping", async () => {
    const onOpenChange = vi.fn();
    const onCropped = vi.fn();
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={sourceFile()}
        onCropped={onCropped}
        onOpenChange={onOpenChange}
        open
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCropped).not.toHaveBeenCalled();
  });

  it("emits a webp file through onCropped after applying the crop", async () => {
    const onCropped = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={sourceFile()}
        onCropped={onCropped}
        onOpenChange={onOpenChange}
        open
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "complete crop" }));

    const apply = screen.getByRole("button", { name: "Застосувати" });
    await waitFor(() => expect(apply).toBeEnabled());
    await userEvent.click(apply);

    await waitFor(() => expect(onCropped).toHaveBeenCalledTimes(1));
    const [firstCall] = onCropped.mock.calls;
    const file = firstCall?.[0] as File | undefined;
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe("image/webp");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
