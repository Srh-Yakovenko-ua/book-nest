import type { ValueOf } from "@app/shared";

import { BadRequestError } from "../../../core/exceptions/errors.js";

export const MEDIA_ERROR_CODES = {
  corruptedImage: "CORRUPTED_IMAGE",
  fileRequired: "FILE_REQUIRED",
  fileTooLarge: "FILE_TOO_LARGE",
  imageTooLarge: "IMAGE_TOO_LARGE",
  invalidCrop: "INVALID_CROP",
  unsupportedType: "UNSUPPORTED_FILE_TYPE",
} as const;

type MediaErrorCode = ValueOf<typeof MEDIA_ERROR_CODES>;

export function mediaError(message: string, code: MediaErrorCode): BadRequestError {
  return new BadRequestError(message, { code });
}
