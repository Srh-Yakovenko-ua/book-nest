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
  it("produces three webp derivatives plus a stripped original with source dimensions", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process(png);

    expect(result.contentType).toBe("image/webp");
    expect(result.derivatives.map((derivative) => derivative.name).sort()).toEqual([
      "card",
      "full",
      "thumb",
    ]);
    expect(result.width).toBe(60);
    expect(result.height).toBe(90);
    expect(result.original.length).toBeGreaterThan(0);
  });

  it("does not upscale a source smaller than a derivative width", async () => {
    const png = await solidPng(60, 90);

    const result = await processor.process(png);
    const full = result.derivatives.find((derivative) => derivative.name === "full");

    expect(full?.width).toBe(60);
  });

  it("rejects an image whose pixel count exceeds the cap (decompression-bomb guard)", async () => {
    const huge = await solidPng(6000, 6000);

    await expect(processor.process(huge)).rejects.toThrow();
  });
});
