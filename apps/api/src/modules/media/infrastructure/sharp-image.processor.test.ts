import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { SharpImageProcessor } from "./sharp-image.processor.js";

const processor = new SharpImageProcessor();

function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { background: { b: 60, g: 90, r: 180 }, channels: 3, height, width } })
    .png()
    .toBuffer();
}

describe("SharpImageProcessor", () => {
  it("produces a single webp image preserving source dimensions when within the cap", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process(png);

    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(60);
    expect(result.height).toBe(90);
    expect(result.body.length).toBeGreaterThan(0);
  });

  it("does not upscale a source smaller than the output edge cap", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process(png);

    expect(result.width).toBe(60);
  });

  it("downscales a large source to the output edge cap", async () => {
    const png = await solidPng(3000, 2000);

    const result = await processor.process(png);

    expect(result.width).toBe(1600);
    expect(result.height).toBe(1067);
  });

  it("rejects an image whose pixel count exceeds the cap (decompression-bomb guard)", async () => {
    const cappedProcessor = new SharpImageProcessor(100);
    const overCap = await solidPng(20, 20);

    await expect(cappedProcessor.process(overCap)).rejects.toThrow();
  });
});
