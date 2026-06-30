import type { MediaCrop } from "@app/shared";
import type { Sharp } from "sharp";

import { Injectable } from "@nestjs/common";
import sharp from "sharp";

import type {
  ProcessedImage,
  ProcessedImageSet,
  ProcessImageOptions,
} from "../domain/image-processor.port.js";

import {
  CropOutOfBoundsError,
  ImageProcessorPort,
  ImageTooLargeError,
} from "../domain/image-processor.port.js";

const OUTPUT_CONTENT_TYPE = "image/webp";
const WEBP_EFFORT = 6;
const DEFAULT_MAX_INPUT_PIXELS = 80_000_000;

const FULL_MAX_EDGE = 1600;
const FULL_QUALITY = 88;
const THUMB_MAX_EDGE = 300;
const THUMB_QUALITY = 80;

const ORIENTATIONS_WITH_SWAPPED_AXES = new Set([5, 6, 7, 8]);

function assertCropWithinBounds({
  crop,
  orientedHeight,
  orientedWidth,
}: {
  crop: MediaCrop;
  orientedHeight: number;
  orientedWidth: number;
}): void {
  const fitsHorizontally = crop.x >= 0 && crop.width > 0 && crop.x + crop.width <= orientedWidth;
  const fitsVertically = crop.y >= 0 && crop.height > 0 && crop.y + crop.height <= orientedHeight;
  if (!fitsHorizontally || !fitsVertically) {
    throw new CropOutOfBoundsError();
  }
}

function orientImageDimensions(input: {
  height: number;
  orientation: number | undefined;
  width: number;
}): { height: number; width: number } {
  if (input.orientation !== undefined && ORIENTATIONS_WITH_SWAPPED_AXES.has(input.orientation)) {
    return { height: input.width, width: input.height };
  }
  return { height: input.height, width: input.width };
}

@Injectable()
export class SharpImageProcessor extends ImageProcessorPort {
  constructor(private readonly maxInputPixels: number = DEFAULT_MAX_INPUT_PIXELS) {
    super();
  }

  async process({ crop, input }: ProcessImageOptions): Promise<ProcessedImageSet> {
    const metadata = await sharp(input, { limitInputPixels: false }).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new Error("Image metadata is missing dimensions");
    }
    if (metadata.width * metadata.height > this.maxInputPixels) {
      throw new ImageTooLargeError();
    }

    const normalized = sharp(input, { limitInputPixels: this.maxInputPixels }).rotate();

    if (crop !== undefined) {
      const { height: orientedHeight, width: orientedWidth } = orientImageDimensions({
        height: metadata.height,
        orientation: metadata.orientation,
        width: metadata.width,
      });
      assertCropWithinBounds({ crop, orientedHeight, orientedWidth });
      normalized.extract({ height: crop.height, left: crop.x, top: crop.y, width: crop.width });
    }

    const [full, thumb] = await Promise.all([
      this.encode({ maxEdge: FULL_MAX_EDGE, pipeline: normalized.clone(), quality: FULL_QUALITY }),
      this.encode({
        maxEdge: THUMB_MAX_EDGE,
        pipeline: normalized.clone(),
        quality: THUMB_QUALITY,
      }),
    ]);

    return { full, thumb };
  }

  private async encode({
    maxEdge,
    pipeline,
    quality,
  }: {
    maxEdge: number;
    pipeline: Sharp;
    quality: number;
  }): Promise<ProcessedImage> {
    const { data, info } = await pipeline
      .resize({ fit: "inside", height: maxEdge, width: maxEdge, withoutEnlargement: true })
      .webp({ effort: WEBP_EFFORT, quality })
      .toBuffer({ resolveWithObject: true });

    return {
      body: data,
      contentType: OUTPUT_CONTENT_TYPE,
      height: info.height,
      width: info.width,
    };
  }
}
