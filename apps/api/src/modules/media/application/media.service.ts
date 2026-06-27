import type { MediaKind, MediaView, Nullable } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB, MediaKindSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ProcessedImage } from "../domain/image-processor.port.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { detectImageMimeType, isAllowedImageMimeType } from "../domain/allowed-image.js";
import { buildDerivativeRecord } from "../domain/derivatives.js";
import { ImageProcessorPort } from "../domain/image-processor.port.js";
import { MEDIA_ERROR_CODES, mediaError } from "../domain/media-error-code.js";
import { StoragePort } from "../domain/storage.port.js";
import { MediaRepository } from "../infrastructure/media.repository.js";

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

  async assertOwned(userId: string, id: string): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById(userId, id);
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

  async delete(userId: string, id: string): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById(userId, id);
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
    await this.mediaRepository.deleteOwned(userId, id);
    await this.removeObjects([asset.storageKey]);
  }

  async upload(userId: string, kind: MediaKind, file: UploadFile): Promise<MediaView> {
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

    const processed = await this.processImage(file.buffer);

    const assetId = randomUUID();
    const key = `media/${kind}/${assetId}/image.webp`;
    await this.storage.put({ body: processed.body, contentType: processed.contentType, key });

    const asset = await this.createAssetOrCleanup(key, {
      contentType: processed.contentType,
      height: processed.height,
      id: assetId,
      kind,
      originalName: normalizeOriginalName(file.originalName),
      sizeBytes: processed.body.length,
      storageKey: key,
      userId,
      width: processed.width,
    });

    return this.buildView(asset);
  }

  private async createAssetOrCleanup(
    key: string,
    data: Prisma.MediaAssetUncheckedCreateInput,
  ): Promise<MediaAssetModel> {
    try {
      return await this.mediaRepository.create(data);
    } catch (error) {
      await this.removeObjects([key]);
      throw error;
    }
  }

  private async processImage(buffer: Buffer): Promise<ProcessedImage> {
    try {
      return await this.imageProcessor.process(buffer);
    } catch (error) {
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
