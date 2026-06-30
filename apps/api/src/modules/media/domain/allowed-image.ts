import type { Nullable } from "@app/shared";

import { fileTypeFromBuffer } from "file-type";

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export async function detectImageMimeType(buffer: Buffer): Promise<Nullable<string>> {
  const result = await fileTypeFromBuffer(buffer);
  return result?.mime ?? null;
}

export function isAllowedImageMimeType(mime: Nullable<string>): mime is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPES.some((allowed) => allowed === mime);
}
