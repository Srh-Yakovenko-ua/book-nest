import type { MediaCrop } from "@app/shared";

type CropImagePreviewInput = {
  crop: MediaCrop;
  file: File;
};

type CropImagePreviewResult = {
  blob: Blob;
  url: string;
};

const FALLBACK_TYPE = "image/webp";

export async function cropImagePreview({
  crop,
  file,
}: CropImagePreviewInput): Promise<CropImagePreviewResult> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;

    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context is unavailable");

    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );

    const blob = await canvasToBlob({ canvas, type: file.type || FALLBACK_TYPE });
    return { blob, url: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob({
  canvas,
  type,
}: {
  canvas: HTMLCanvasElement;
  type: string;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("Failed to encode the cropped preview"));
        return;
      }
      resolve(blob);
    }, type);
  });
}
