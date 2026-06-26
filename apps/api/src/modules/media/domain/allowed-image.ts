import type { Nullable } from "@app/shared";

import { fileTypeFromBuffer } from "file-type";

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<AllowedImageMimeType, string>;

export async function detectImageMimeType(buffer: Buffer): Promise<Nullable<string>> {
  const result = await fileTypeFromBuffer(buffer);
  return result?.mime ?? null;
}

export function extensionForMimeType(mime: AllowedImageMimeType): string {
  return EXTENSION_BY_MIME[mime];
}

export function isAllowedImageMimeType(mime: Nullable<string>): mime is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.some((allowed) => allowed === mime);
}
