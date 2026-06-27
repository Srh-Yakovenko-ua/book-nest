export type ProcessedImage = {
  body: Buffer;
  contentType: string;
  height: number;
  width: number;
};

export abstract class ImageProcessorPort {
  abstract process(input: Buffer): Promise<ProcessedImage>;
}
