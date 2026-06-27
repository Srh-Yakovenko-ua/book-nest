export type CropArea = { height: number; width: number; x: number; y: number };

const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.9;
const FALLBACK_FILE_NAME = "cover.webp";

export class CropImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CropImageError";
  }
}

export async function cropImageToFile({
  area,
  imageSrc,
  sourceName,
}: {
  area: CropArea;
  imageSrc: string;
  sourceName?: string;
}): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);

  const context = canvas.getContext("2d");
  if (context === null) throw new CropImageError("Canvas 2D context is unavailable");

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await canvasToBlob(canvas);
  return new File([blob], toWebpName(sourceName), { type: OUTPUT_TYPE });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new CropImageError("Failed to export cropped image"));
          return;
        }
        resolve(blob);
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new CropImageError("Failed to load image")));
    image.src = src;
  });
}

function toWebpName(sourceName: string | undefined): string {
  const base = sourceName?.replace(/\.[^.]+$/, "").trim();
  return base ? `${base}.webp` : FALLBACK_FILE_NAME;
}
