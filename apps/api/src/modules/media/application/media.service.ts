import type { MediaCrop, MediaKind, MediaView, Nullable } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB, MediaKindSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ProcessedImage } from "../domain/image-processor.port.js";
import type { MediaOwnerRef } from "../infrastructure/media.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { detectImageMimeType, isAllowedImageMimeType } from "../domain/allowed-image.js";
import { buildDerivativeRecord } from "../domain/derivatives.js";
import {
  CropOutOfBoundsError,
  ImageProcessorPort,
  ImageTooLargeError,
} from "../domain/image-processor.port.js";
import { MEDIA_ERROR_CODES, mediaError } from "../domain/media-error-code.js";
import { StoragePort } from "../domain/storage.port.js";
import { MediaRepository } from "../infrastructure/media.repository.js";

export type UploadCommand = {
  crop?: MediaCrop;
  file: UploadFile;
  kind: MediaKind;
  userId: string;
};

export type UploadFile = {
  buffer: Buffer;
  originalName: Nullable<string>;
  size: number;
};

const MAX_ORIGINAL_NAME_LENGTH = 255;

const log = createLogger("media");

const MIN_PRINTABLE_CODE_POINT = 0x20;
const DELETE_CODE_POINT = 0x7f;

function normalizeOriginalName(name: Nullable<string>): Nullable<string> {
  if (name === null || name === undefined) {
    return null;
  }
  const printable = Array.from(name).filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= MIN_PRINTABLE_CODE_POINT && code !== DELETE_CODE_POINT;
  });
  const trimmed = printable.join("").trim();
  if (trimmed === "") {
    return null;
  }
  return Array.from(trimmed).slice(0, MAX_ORIGINAL_NAME_LENGTH).join("");
}

@Injectable()
export class MediaService {
  constructor(
    private readonly imageProcessor: ImageProcessorPort,
    private readonly mediaRepository: MediaRepository,
    private readonly storage: StoragePort,
  ) {}

  async assertOwned({ id, userId }: MediaOwnerRef): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id, userId });
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
  }

  buildView(asset: MediaAssetModel): MediaView {
    const url = this.storage.publicUrl(asset.storageKey);
    return {
      contentType: asset.contentType,
      createdAt: asset.createdAt.toISOString(),
      height: asset.height,
      id: asset.id,
      kind: MediaKindSchema.parse(asset.kind),
      name: asset.originalName,
      sizeBytes: asset.sizeBytes,
      urls: buildDerivativeRecord(() => url),
      width: asset.width,
    };
  }

  async delete({ id, userId }: MediaOwnerRef): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id, userId });
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
    await this.mediaRepository.deleteOwned({ id, userId });
    await this.removeObjects([asset.storageKey]);
  }

  async upload({ crop, file, kind, userId }: UploadCommand): Promise<MediaView> {
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      throw mediaError(
        `File size must not exceed ${MEDIA_MAX_UPLOAD_MB} MB`,
        MEDIA_ERROR_CODES.fileTooLarge,
      );
    }

    const mimeType = await detectImageMimeType(file.buffer);
    if (!isAllowedImageMimeType(mimeType)) {
      throw mediaError("File must be a JPG, PNG or WEBP image", MEDIA_ERROR_CODES.unsupportedType);
    }

    const processed = await this.processImage({ buffer: file.buffer, crop });

    const assetId = randomUUID();
    const key = `media/${kind}/${assetId}/image.webp`;
    await this.storage.put({ body: processed.body, contentType: processed.contentType, key });

    const asset = await this.createAssetOrCleanup({
      data: {
        contentType: processed.contentType,
        height: processed.height,
        id: assetId,
        kind,
        originalName: normalizeOriginalName(file.originalName),
        sizeBytes: processed.body.length,
        storageKey: key,
        userId,
        width: processed.width,
      },
      key,
    });

    return this.buildView(asset);
  }

  private async createAssetOrCleanup({
    data,
    key,
  }: {
    data: Prisma.MediaAssetUncheckedCreateInput;
    key: string;
  }): Promise<MediaAssetModel> {
    try {
      return await this.mediaRepository.create(data);
    } catch (error) {
      await this.removeObjects([key]);
      throw error;
    }
  }

  private async processImage({
    buffer,
    crop,
  }: {
    buffer: Buffer;
    crop?: MediaCrop;
  }): Promise<ProcessedImage> {
    try {
      return await this.imageProcessor.process({ crop, input: buffer });
    } catch (error) {
      if (error instanceof ImageTooLargeError) {
        throw mediaError("Image has too many pixels", MEDIA_ERROR_CODES.imageTooLarge);
      }
      if (error instanceof CropOutOfBoundsError) {
        throw mediaError("Crop area is out of image bounds", MEDIA_ERROR_CODES.invalidCrop);
      }
      log.warn({ err: error }, "image processing failed");
      throw mediaError("Image is corrupted or unsupported", MEDIA_ERROR_CODES.corruptedImage);
    }
  }

  private async removeObjects(keys: string[]): Promise<void> {
    try {
      await this.storage.delete(keys);
    } catch (error) {
      log.warn({ err: error }, "failed to delete media objects from storage");
    }
  }
}
