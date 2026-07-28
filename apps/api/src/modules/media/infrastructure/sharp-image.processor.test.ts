import { crc32 } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { CropOutOfBoundsError, ImageTooLargeError } from "../domain/image-processor.port.js";
import { SharpImageProcessor } from "./sharp-image.processor.js";

const processor = new SharpImageProcessor();

const PNG_IHDR_OFFSETS = {
  crc: 29,
  height: 20,
  type: 12,
  width: 16,
} as const;

const PIXEL_CAP = {
  squareEdge: 5000,
  squareEdgeOverCap: 5001,
} as const;

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

async function pngDeclaringDimensions({
  height,
  width,
}: {
  height: number;
  width: number;
}): Promise<Buffer> {
  const png = await solidPng(4, 4);
  png.writeUInt32BE(width, PNG_IHDR_OFFSETS.width);
  png.writeUInt32BE(height, PNG_IHDR_OFFSETS.height);
  png.writeUInt32BE(
    crc32(png.subarray(PNG_IHDR_OFFSETS.type, PNG_IHDR_OFFSETS.crc)) >>> 0,
    PNG_IHDR_OFFSETS.crc,
  );
  return png;
}

function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { background: { b: 60, g: 90, r: 180 }, channels: 3, height, width } })
    .png()
    .toBuffer();
}

describe("SharpImageProcessor.processFull", () => {
  it("produces a full webp derivative preserving source dimensions when within the cap", async () => {
    const png = await solidPng(60, 90);

    const full = await processor.processFull({ input: png });

    expect(full.contentType).toBe("image/webp");
    expect(full.width).toBe(60);
    expect(full.height).toBe(90);
    expect(full.body.length).toBeGreaterThan(0);
  });

  it("does not upscale the full derivative for a source smaller than its edge cap", async () => {
    const png = await solidPng(60, 90);

    const full = await processor.processFull({ input: png });

    expect(full.width).toBe(60);
  });

  it("downscales the full derivative to its edge cap", async () => {
    const png = await solidPng(3000, 2000);

    const full = await processor.processFull({ input: png });

    expect(full.width).toBe(1600);
    expect(full.height).toBe(1067);
  });

  it("rejects an image whose pixel count exceeds the cap (decompression-bomb guard)", async () => {
    const cappedProcessor = new SharpImageProcessor(100);
    const overCap = await solidPng(20, 20);

    await expect(cappedProcessor.processFull({ input: overCap })).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("rejects a header-declared bomb over the default cap without decoding its pixels", async () => {
    const declaredBomb = await pngDeclaringDimensions({
      height: PIXEL_CAP.squareEdge,
      width: PIXEL_CAP.squareEdgeOverCap,
    });

    await expect(processor.processFull({ input: declaredBomb })).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("admits a header-declared image exactly at the default cap and fails only once decoding starts", async () => {
    const atCap = await pngDeclaringDimensions({
      height: PIXEL_CAP.squareEdge,
      width: PIXEL_CAP.squareEdge,
    });

    await expect(processor.processFull({ input: atCap })).rejects.not.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("applies the requested crop to the full derivative", async () => {
    const png = await solidPng(1200, 1600);

    const full = await processor.processFull({
      crop: { height: 800, width: 600, x: 100, y: 200 },
      input: png,
    });

    expect(full.width).toBe(600);
    expect(full.height).toBe(800);
  });

  it("rejects a crop rectangle that extends beyond the image bounds", async () => {
    const png = await solidPng(1200, 1600);

    await expect(
      processor.processFull({ crop: { height: 800, width: 600, x: 700, y: 200 }, input: png }),
    ).rejects.toBeInstanceOf(CropOutOfBoundsError);
  });

  it("crops in oriented space for an EXIF orientation that swaps axes", async () => {
    const jpeg = await orientedJpeg({ height: 90, orientation: 6, width: 60 });

    const full = await processor.processFull({
      crop: { height: 50, width: 80, x: 0, y: 0 },
      input: jpeg,
    });

    expect(full.width).toBe(80);
    expect(full.height).toBe(50);
  });

  it("rejects a crop valid only in stored space but out of bounds once oriented", async () => {
    const jpeg = await orientedJpeg({ height: 90, orientation: 6, width: 60 });

    await expect(
      processor.processFull({ crop: { height: 85, width: 50, x: 0, y: 0 }, input: jpeg }),
    ).rejects.toBeInstanceOf(CropOutOfBoundsError);
  });
});

describe("SharpImageProcessor.generateThumbnail", () => {
  it("downscales a full webp image to the thumbnail edge cap", async () => {
    const full = await processor.processFull({ input: await solidPng(3000, 2000) });

    const thumb = await processor.generateThumbnail({ input: full.body });

    expect(thumb.contentType).toBe("image/webp");
    expect(thumb.width).toBe(300);
    expect(thumb.height).toBe(200);
    expect(thumb.width).toBeLessThanOrEqual(full.width);
    expect(thumb.body.length).toBeGreaterThan(0);
  });

  it("does not upscale a full image already smaller than the thumbnail cap", async () => {
    const full = await processor.processFull({ input: await solidPng(60, 90) });

    const thumb = await processor.generateThumbnail({ input: full.body });

    expect(thumb.width).toBe(60);
    expect(thumb.height).toBe(90);
  });
});
