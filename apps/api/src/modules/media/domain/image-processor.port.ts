import type { MediaCrop } from "@app/shared";

export type GenerateThumbnailOptions = {
  input: Buffer;
};

export type ProcessedImage = {
  body: Buffer;
  contentType: string;
  height: number;
  width: number;
};

export type ProcessImageOptions = {
  crop?: MediaCrop;
  input: Buffer;
};

export class CropOutOfBoundsError extends Error {
  constructor(message = "Crop area is out of image bounds") {
    super(message);
    this.name = "CropOutOfBoundsError";
  }
}

export abstract class ImageProcessorPort {
  abstract generateThumbnail(options: GenerateThumbnailOptions): Promise<ProcessedImage>;
  abstract processFull(options: ProcessImageOptions): Promise<ProcessedImage>;
}

export class ImageTooLargeError extends Error {
  constructor(message = "Image exceeds the maximum allowed pixel count") {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

export class InvalidImageError extends Error {
  constructor(message = "Image is not a readable image") {
    super(message);
    this.name = "InvalidImageError";
  }
}
