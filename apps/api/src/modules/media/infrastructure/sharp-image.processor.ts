import { MEDIA_DERIVATIVES, type MediaDerivative } from "@app/shared";
import { Injectable } from "@nestjs/common";
import sharp from "sharp";

import type { ProcessedDerivative, ProcessedImage } from "../domain/image-processor.port.js";

import { ImageProcessorPort } from "../domain/image-processor.port.js";

const OUTPUT_CONTENT_TYPE = "image/webp";
const WEBP_EFFORT = 5;
const MAX_INPUT_PIXELS = 24_000_000;

const DERIVATIVE_SPECS = {
  card: { quality: 78, width: 400 },
  full: { quality: 80, width: 800 },
  thumb: { quality: 70, width: 200 },
} satisfies Record<MediaDerivative, { quality: number; width: number }>;

@Injectable()
export class SharpImageProcessor extends ImageProcessorPort {
  async process(input: Buffer): Promise<ProcessedImage> {
    const metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new Error("Image metadata is missing dimensions");
    }
    if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
      throw new Error("Image exceeds the maximum allowed pixel count");
    }

    const original = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().toBuffer();

    const derivatives: ProcessedDerivative[] = [];
    for (const name of MEDIA_DERIVATIVES) {
      const { quality, width } = DERIVATIVE_SPECS[name];
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ effort: WEBP_EFFORT, quality })
        .toBuffer({ resolveWithObject: true });
      derivatives.push({ body: data, height: info.height, name, width: info.width });
    }

    return {
      contentType: OUTPUT_CONTENT_TYPE,
      derivatives,
      height: metadata.height,
      original,
      width: metadata.width,
    };
  }
}
