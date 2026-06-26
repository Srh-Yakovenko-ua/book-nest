import type { MediaDerivative } from "@app/shared";

export type ProcessedDerivative = {
  body: Buffer;
  height: number;
  name: MediaDerivative;
  width: number;
};

export type ProcessedImage = {
  contentType: string;
  derivatives: ProcessedDerivative[];
  height: number;
  original: Buffer;
  width: number;
};

export abstract class ImageProcessorPort {
  abstract process(input: Buffer): Promise<ProcessedImage>;
}
