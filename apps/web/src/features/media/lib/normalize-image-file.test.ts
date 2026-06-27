import { heicTo, isHeic } from "heic-to";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HeicConversionError, normalizeImageFile } from "./normalize-image-file";

vi.mock("heic-to", () => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeImageFile", () => {
  it("converts a HEIC file into a JPEG File with a .jpg name", async () => {
    vi.mocked(isHeic).mockResolvedValue(true);
    vi.mocked(heicTo).mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));

    const result = await normalizeImageFile(
      new File(["heic"], "IMG_4231.HEIC", { type: "image/heic" }),
    );

    expect(result).toBeInstanceOf(File);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("IMG_4231.jpg");
  });

  it("returns a jpeg untouched without importing heic-to", async () => {
    const jpeg = new File(["x"], "cover.jpg", { type: "image/jpeg" });

    const result = await normalizeImageFile(jpeg);

    expect(result).toBe(jpeg);
    expect(isHeic).not.toHaveBeenCalled();
    expect(heicTo).not.toHaveBeenCalled();
  });

  it("throws HeicConversionError when conversion fails", async () => {
    vi.mocked(isHeic).mockResolvedValue(true);
    vi.mocked(heicTo).mockRejectedValue(new Error("libheif boom"));

    await expect(
      normalizeImageFile(new File(["heic"], "photo.heic", { type: "image/heic" })),
    ).rejects.toBeInstanceOf(HeicConversionError);
  });
});
