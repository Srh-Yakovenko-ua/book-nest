import type { MediaKind, MediaView } from "@app/shared";

import {
  MEDIA_DERIVATIVES,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_MAX_UPLOAD_MB,
  MediaDerivativeSchema,
  MediaKindSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ProcessedImage } from "../domain/image-processor.port.js";
import type { StoredObject } from "../domain/storage.port.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import {
  detectImageMimeType,
  extensionForMimeType,
  isAllowedImageMimeType,
} from "../domain/allowed-image.js";
import { buildDerivativeRecord } from "../domain/derivatives.js";
import { ImageProcessorPort } from "../domain/image-processor.port.js";
import { MEDIA_ERROR_CODES, mediaError } from "../domain/media-error-code.js";
import { StoragePort } from "../domain/storage.port.js";
import { MediaRepository } from "../infrastructure/media.repository.js";

export type UploadFile = {
  buffer: Buffer;
  size: number;
};

const StoredDerivativesSchema = z.record(MediaDerivativeSchema, z.string());

const log = createLogger("media");

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
      throw new NotFoundError("Cover media not found");
    }
  }

  buildView(asset: MediaAssetModel): MediaView {
    const keys = StoredDerivativesSchema.parse(asset.derivatives);
    return {
      height: asset.height,
      id: asset.id,
      kind: MediaKindSchema.parse(asset.kind),
      urls: buildDerivativeRecord((derivative) => this.storage.publicUrl(keys[derivative])),
      width: asset.width,
    };
  }

  async delete(userId: string, id: string): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById(userId, id);
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
    const keys = StoredDerivativesSchema.parse(asset.derivatives);
    await this.mediaRepository.deleteOwned(userId, id);
    await this.removeObjects([
      asset.originalKey,
      ...MEDIA_DERIVATIVES.map((derivative) => keys[derivative]),
    ]);
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
    const prefix = `media/${kind}/${assetId}`;
    const originalKey = `${prefix}/original.${extensionForMimeType(mimeType)}`;
    const derivativeKeys = buildDerivativeRecord((derivative) => `${prefix}/${derivative}.webp`);

    const objects: StoredObject[] = [
      { body: processed.original, contentType: mimeType, key: originalKey },
      ...processed.derivatives.map((derivative) => ({
        body: derivative.body,
        contentType: processed.contentType,
        key: derivativeKeys[derivative.name],
      })),
    ];
    await Promise.all(objects.map((object) => this.storage.put(object)));

    const asset = await this.mediaRepository.create({
      contentType: processed.contentType,
      derivatives: derivativeKeys,
      height: processed.height,
      id: assetId,
      kind,
      originalKey,
      sizeBytes: file.size,
      userId,
      width: processed.width,
    });

    return this.buildView(asset);
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
