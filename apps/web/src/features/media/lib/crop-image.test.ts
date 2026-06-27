import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CropImageError, cropImageToFile } from "./crop-image";

const area = { height: 150, width: 100, x: 0, y: 0 };

class FailingImage {
  set src(_value: string) {
    queueMicrotask(() => this.errorHandler?.());
  }

  private errorHandler: (() => void) | null = null;

  addEventListener(type: string, handler: () => void) {
    if (type === "error") this.errorHandler = handler;
  }
}

class LoadingImage {
  set src(_value: string) {
    queueMicrotask(() => this.loadHandler?.());
  }

  private loadHandler: (() => void) | null = null;

  addEventListener(type: string, handler: () => void) {
    if (type === "load") this.loadHandler = handler;
  }
}

function stubBlob(blob: Blob | null) {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(blob);
  });
}

function stubContext(context: null | { drawImage: () => void }) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}

beforeEach(() => {
  vi.stubGlobal("Image", LoadingImage);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cropImageToFile", () => {
  it("returns a webp file built from the cropped canvas", async () => {
    const drawImage = vi.fn();
    stubContext({ drawImage });
    stubBlob(new Blob(["cropped"], { type: "image/webp" }));

    const file = await cropImageToFile({ area, imageSrc: "blob:cover" });

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("cover.webp");
    expect(drawImage).toHaveBeenCalled();
  });

  it("throws CropImageError when the 2D context is unavailable", async () => {
    stubContext(null);

    await expect(cropImageToFile({ area, imageSrc: "blob:cover" })).rejects.toBeInstanceOf(
      CropImageError,
    );
  });

  it("throws CropImageError when the canvas cannot export a blob", async () => {
    stubContext({ drawImage: vi.fn() });
    stubBlob(null);

    await expect(cropImageToFile({ area, imageSrc: "blob:cover" })).rejects.toBeInstanceOf(
      CropImageError,
    );
  });

  it("throws CropImageError when the source image fails to load", async () => {
    vi.stubGlobal("Image", FailingImage);

    await expect(cropImageToFile({ area, imageSrc: "blob:broken" })).rejects.toBeInstanceOf(
      CropImageError,
    );
  });
});
