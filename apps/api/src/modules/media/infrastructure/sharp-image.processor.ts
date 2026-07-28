import type { MediaCrop } from "@app/shared";
import type { Sharp } from "sharp";

import { Injectable } from "@nestjs/common";
import sharp from "sharp";

import type {
  GenerateThumbnailOptions,
  ProcessedImage,
  ProcessImageOptions,
} from "../domain/image-processor.port.js";

import {
  CropOutOfBoundsError,
  ImageProcessorPort,
  ImageTooLargeError,
  InvalidImageError,
} from "../domain/image-processor.port.js";

sharp.concurrency(1);
sharp.cache(false);

const IMAGE_PIPELINE = {
  full: { maxEdge: 1600, quality: 88 },
  maxInputPixels: 25_000_000,
  outputContentType: "image/webp",
  thumb: { maxEdge: 300, quality: 80 },
  webpEffort: 6,
} as const;

const ORIENTATIONS_WITH_SWAPPED_AXES = new Set([5, 6, 7, 8]);

@Injectable()
export class SharpImageProcessor extends ImageProcessorPort {
  constructor(private readonly maxInputPixels: number = IMAGE_PIPELINE.maxInputPixels) {
    super();
  }

  generateThumbnail({ input }: GenerateThumbnailOptions): Promise<ProcessedImage> {
    return this.encode({
      maxEdge: IMAGE_PIPELINE.thumb.maxEdge,
      pipeline: sharp(input, { limitInputPixels: this.maxInputPixels }),
      quality: IMAGE_PIPELINE.thumb.quality,
    });
  }

  async processFull({ crop, input }: ProcessImageOptions): Promise<ProcessedImage> {
    const normalized = await this.normalize({ crop, input });
    return this.encode({
      maxEdge: IMAGE_PIPELINE.full.maxEdge,
      pipeline: normalized,
      quality: IMAGE_PIPELINE.full.quality,
    });
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
      .webp({ effort: IMAGE_PIPELINE.webpEffort, quality })
      .toBuffer({ resolveWithObject: true });

    return {
      body: data,
      contentType: IMAGE_PIPELINE.outputContentType,
      height: info.height,
      width: info.width,
    };
  }

  private async normalize({ crop, input }: ProcessImageOptions): Promise<Sharp> {
    const metadata = await sharp(input, { limitInputPixels: false }).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new InvalidImageError("Image metadata is missing dimensions");
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

    return normalized;
  }
}

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
