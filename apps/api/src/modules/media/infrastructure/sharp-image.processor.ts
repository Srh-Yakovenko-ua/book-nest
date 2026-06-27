import { Injectable } from "@nestjs/common";
import sharp from "sharp";

import type { ProcessedImage } from "../domain/image-processor.port.js";

import { ImageProcessorPort } from "../domain/image-processor.port.js";

const OUTPUT_CONTENT_TYPE = "image/webp";
const WEBP_EFFORT = 5;
const WEBP_QUALITY = 82;
const MAX_OUTPUT_EDGE = 1280;
const DEFAULT_MAX_INPUT_PIXELS = 80_000_000;

@Injectable()
export class SharpImageProcessor extends ImageProcessorPort {
  constructor(private readonly maxInputPixels: number = DEFAULT_MAX_INPUT_PIXELS) {
    super();
  }

  async process(input: Buffer): Promise<ProcessedImage> {
    const metadata = await sharp(input, { limitInputPixels: this.maxInputPixels }).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new Error("Image metadata is missing dimensions");
    }
    if (metadata.width * metadata.height > this.maxInputPixels) {
      throw new Error("Image exceeds the maximum allowed pixel count");
    }

    const { data, info } = await sharp(input, { limitInputPixels: this.maxInputPixels })
      .rotate()
      .resize({
        fit: "inside",
        height: MAX_OUTPUT_EDGE,
        width: MAX_OUTPUT_EDGE,
        withoutEnlargement: true,
      })
      .webp({ effort: WEBP_EFFORT, quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return {
      body: data,
      contentType: OUTPUT_CONTENT_TYPE,
      height: info.height,
      width: info.width,
    };
  }
}
