import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { CropOutOfBoundsError, ImageTooLargeError } from "../domain/image-processor.port.js";
import { SharpImageProcessor } from "./sharp-image.processor.js";

const processor = new SharpImageProcessor();

function orientedJpeg({
  height,
  orientation,
  width,
}: {
  height: number;
  orientation: number;
  width: number;
}): Promise<Buffer> {
  return sharp({ create: { background: { b: 60, g: 90, r: 180 }, channels: 3, height, width } })
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();
}

function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { background: { b: 60, g: 90, r: 180 }, channels: 3, height, width } })
    .png()
    .toBuffer();
}

describe("SharpImageProcessor", () => {
  it("produces full and thumb webp derivatives preserving source dimensions when within the cap", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process({ input: png });

    expect(result.full.contentType).toBe("image/webp");
    expect(result.full.width).toBe(60);
    expect(result.full.height).toBe(90);
    expect(result.thumb.contentType).toBe("image/webp");
    expect(result.thumb.width).toBeLessThanOrEqual(result.full.width);
    expect(result.full.body.length).toBeGreaterThan(0);
    expect(result.thumb.body.length).toBeGreaterThan(0);
  });

  it("does not upscale either derivative for a source smaller than its edge cap", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process({ input: png });

    expect(result.full.width).toBe(60);
    expect(result.thumb.width).toBe(60);
  });

  it("downscales the full derivative to its edge cap and the thumb to a smaller cap", async () => {
    const png = await solidPng(3000, 2000);

    const result = await processor.process({ input: png });

    expect(result.full.width).toBe(1600);
    expect(result.full.height).toBe(1067);
    expect(result.thumb.width).toBe(300);
    expect(result.thumb.height).toBe(200);
    expect(result.thumb.width).toBeLessThanOrEqual(result.full.width);
  });

  it("rejects an image whose pixel count exceeds the cap (decompression-bomb guard)", async () => {
    const cappedProcessor = new SharpImageProcessor(100);
    const overCap = await solidPng(20, 20);

    await expect(cappedProcessor.process({ input: overCap })).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("applies the requested crop to both derivatives", async () => {
    const png = await solidPng(1200, 1600);

    const result = await processor.process({
      crop: { height: 800, width: 600, x: 100, y: 200 },
      input: png,
    });

    expect(result.full.width).toBe(600);
    expect(result.full.height).toBe(800);
    expect(result.thumb.height).toBe(300);
    expect(result.thumb.width).toBeLessThanOrEqual(result.full.width);
  });

  it("rejects a crop rectangle that extends beyond the image bounds", async () => {
    const png = await solidPng(1200, 1600);

    await expect(
      processor.process({ crop: { height: 800, width: 600, x: 700, y: 200 }, input: png }),
    ).rejects.toBeInstanceOf(CropOutOfBoundsError);
  });

  it("crops in oriented space for an EXIF orientation that swaps axes", async () => {
    const jpeg = await orientedJpeg({ height: 90, orientation: 6, width: 60 });

    const result = await processor.process({
      crop: { height: 50, width: 80, x: 0, y: 0 },
      input: jpeg,
    });

    expect(result.full.width).toBe(80);
    expect(result.full.height).toBe(50);
    expect(result.thumb.width).toBeLessThanOrEqual(result.full.width);
  });

  it("rejects a crop valid only in stored space but out of bounds once oriented", async () => {
    const jpeg = await orientedJpeg({ height: 90, orientation: 6, width: 60 });

    await expect(
      processor.process({ crop: { height: 85, width: 50, x: 0, y: 0 }, input: jpeg }),
    ).rejects.toBeInstanceOf(CropOutOfBoundsError);
  });
});
