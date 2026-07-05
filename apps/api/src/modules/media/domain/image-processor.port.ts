import type { MediaCrop } from "@app/shared";

export type ProcessedImage = {
  body: Buffer;
  contentType: string;
  height: number;
  width: number;
};

export type ProcessedImageSet = {
  full: ProcessedImage;
  thumb: ProcessedImage;
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
  abstract process(options: ProcessImageOptions): Promise<ProcessedImageSet>;
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
