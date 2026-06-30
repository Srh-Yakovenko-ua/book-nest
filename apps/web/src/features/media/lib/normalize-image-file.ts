const PASSTHROUGH_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];
const HEIC_EXTENSION = /\.(heic|heif)$/i;

export class HeicConversionError extends Error {
  constructor() {
    super("Failed to convert HEIC image");
    this.name = "HeicConversionError";
  }
}

export function isHeicCandidate(file: File): boolean {
  return HEIC_TYPES.includes(file.type) || file.type === "" || HEIC_EXTENSION.test(file.name);
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (PASSTHROUGH_TYPES.includes(file.type)) return file;
  if (!isHeicCandidate(file)) return file;

  const { heicTo, isHeic } = await import("heic-to");
  if (!(await isHeic(file))) return file;

  try {
    const blob = await heicTo({ blob: file, quality: 0.9, type: "image/jpeg" });
    return new File([blob], toJpegName(file.name), { type: "image/jpeg" });
  } catch {
    throw new HeicConversionError();
  }
}

function toJpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.jpg`;
}
