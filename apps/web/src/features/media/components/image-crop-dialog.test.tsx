import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { ImageCropDialog } from "./image-crop-dialog";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(toast.error).mockClear();
});

class ErroringFileReader {
  readonly result: null | string = null;
  private listeners: Record<string, Array<() => void>> = {};
  abort() {}
  addEventListener(type: string, callback: () => void) {
    (this.listeners[type] ??= []).push(callback);
  }
  readAsDataURL() {
    queueMicrotask(() => {
      for (const callback of this.listeners.error ?? []) callback();
    });
  }
}

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

  it("toasts and closes when the file cannot be read", async () => {
    const onOpenChange = vi.fn();
    vi.stubGlobal("FileReader", ErroringFileReader);

    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={sourceFile()}
        onCropped={vi.fn()}
        onOpenChange={onOpenChange}
        open
      />,
    );

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Не вдалося обробити зображення"),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("emits the original file and rounded crop through onCropped after applying", async () => {
    const onCropped = vi.fn();
    const onOpenChange = vi.fn();
    const file = sourceFile();
    renderWithProviders(
      <ImageCropDialog
        aspect={COVER_ASPECT}
        file={file}
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
    expect(onCropped).toHaveBeenCalledWith({
      crop: { height: 150, width: 100, x: 0, y: 0 },
      file,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
