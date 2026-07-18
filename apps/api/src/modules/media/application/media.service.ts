import type { MediaCrop, MediaKind, MediaView, Nullable } from "@app/shared";
import type { Queue } from "bullmq";

import { MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_UPLOAD_MB, MediaKindSchema } from "@app/shared";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ProcessedImage } from "../domain/image-processor.port.js";
import type { GenerateThumbJob } from "../domain/media-queue.js";
import type { StoredObject } from "../domain/storage.port.js";
import type { MediaOwnerRef } from "../infrastructure/media.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { detectImageMimeType, isAllowedImageMimeType } from "../domain/allowed-image.js";
import { buildDerivativeRecord } from "../domain/derivatives.js";
import {
  CropOutOfBoundsError,
  ImageProcessorPort,
  ImageTooLargeError,
  InvalidImageError,
} from "../domain/image-processor.port.js";
import { MEDIA_ERROR_CODES, mediaError } from "../domain/media-error-code.js";
import { thumbKey } from "../domain/media-keys.js";
import { GENERATE_THUMB_JOB, MEDIA_QUEUE_NAME } from "../domain/media-queue.js";
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
    @InjectQueue(MEDIA_QUEUE_NAME) private readonly thumbnailQueue: Queue<GenerateThumbJob>,
  ) {}

  async assertOwned({ id, userId }: MediaOwnerRef): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id, userId });
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
  }

  buildView(asset: MediaAssetModel): MediaView {
    const fullUrl = this.storage.publicUrl(asset.storageKey);
    const thumbUrl =
      asset.thumbGeneratedAt === null
        ? fullUrl
        : this.storage.publicUrl(thumbKey(asset.storageKey));
    return {
      contentType: asset.contentType,
      createdAt: asset.createdAt.toISOString(),
      height: asset.height,
      id: asset.id,
      kind: MediaKindSchema.parse(asset.kind),
      name: asset.originalName,
      sizeBytes: asset.sizeBytes,
      urls: buildDerivativeRecord((derivative) => (derivative === "thumb" ? thumbUrl : fullUrl)),
      width: asset.width,
    };
  }

  async delete({ id, userId }: MediaOwnerRef): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id, userId });
    if (asset === null) {
      throw new NotFoundError("Media not found");
    }
    await this.removeAsset(asset);
  }

  async deleteIfUnreferenced({ id, userId }: MediaOwnerRef): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id, userId });
    if (asset === null) {
      return;
    }
    const references = await this.mediaRepository.countReferences(id);
    if (references > 0) {
      return;
    }
    await this.removeAsset(asset);
  }

  async generateThumbnail({ assetId, userId }: GenerateThumbJob): Promise<void> {
    const asset = await this.mediaRepository.findOwnedById({ id: assetId, userId });
    if (asset === null) {
      log.info({ assetId }, "media asset gone before thumbnail generation, skipping");
      return;
    }

    const original = await this.storage.get(asset.storageKey);
    const thumbnail = await this.imageProcessor.generateThumbnail({ input: original });
    const thumbObjectKey = thumbKey(asset.storageKey);
    await this.storage.put({
      body: thumbnail.body,
      contentType: thumbnail.contentType,
      key: thumbObjectKey,
    });

    const marked = await this.mediaRepository.markThumbGenerated(asset.id);
    if (!marked) {
      log.info(
        { assetId },
        "media asset deleted during thumbnail generation, removing orphan thumb",
      );
      await this.removeObjects([thumbObjectKey]);
    }
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

    const full = await this.processFullImage({ buffer: file.buffer, crop });

    const assetId = randomUUID();
    const storageKey = `media/${kind}/${assetId}/image.webp`;

    await this.storeObjects([{ body: full.body, contentType: full.contentType, key: storageKey }]);

    const asset = await this.createAssetOrCleanup({
      data: {
        contentType: full.contentType,
        height: full.height,
        id: assetId,
        kind,
        originalName: normalizeOriginalName(file.originalName),
        sizeBytes: full.body.length,
        storageKey,
        thumbGeneratedAt: null,
        userId,
        width: full.width,
      },
      keys: [storageKey],
    });

    await this.enqueueThumbnail({ assetId, userId });

    return this.buildView(asset);
  }

  private async createAssetOrCleanup({
    data,
    keys,
  }: {
    data: Prisma.MediaAssetUncheckedCreateInput;
    keys: string[];
  }): Promise<MediaAssetModel> {
    try {
      return await this.mediaRepository.create(data);
    } catch (error) {
      await this.removeObjects(keys);
      throw error;
    }
  }

  private async enqueueThumbnail(payload: GenerateThumbJob): Promise<void> {
    try {
      await this.thumbnailQueue.add(GENERATE_THUMB_JOB, payload);
    } catch (error) {
      log.warn({ assetId: payload.assetId, err: error }, "failed to enqueue thumbnail job");
    }
  }

  private async processFullImage({
    buffer,
    crop,
  }: {
    buffer: Buffer;
    crop?: MediaCrop;
  }): Promise<ProcessedImage> {
    try {
      return await this.imageProcessor.processFull({ crop, input: buffer });
    } catch (error) {
      if (error instanceof ImageTooLargeError) {
        throw mediaError("Image has too many pixels", MEDIA_ERROR_CODES.imageTooLarge);
      }
      if (error instanceof CropOutOfBoundsError) {
        throw mediaError("Crop area is out of image bounds", MEDIA_ERROR_CODES.invalidCrop);
      }
      if (error instanceof InvalidImageError) {
        throw mediaError("Image is corrupted or unsupported", MEDIA_ERROR_CODES.corruptedImage);
      }
      log.warn({ err: error }, "image processing failed");
      throw mediaError("Image is corrupted or unsupported", MEDIA_ERROR_CODES.corruptedImage);
    }
  }

  private async removeAsset(asset: MediaAssetModel): Promise<void> {
    await this.mediaRepository.deleteOwned({ id: asset.id, userId: asset.userId });
    const keys =
      asset.thumbGeneratedAt === null
        ? [asset.storageKey]
        : [asset.storageKey, thumbKey(asset.storageKey)];
    await this.removeObjects(keys);
  }

  private async removeObjects(keys: string[]): Promise<void> {
    try {
      await this.storage.delete(keys);
    } catch (error) {
      log.warn({ err: error }, "failed to delete media objects from storage");
    }
  }

  private async storeObjects(objects: StoredObject[]): Promise<void> {
    const writtenKeys: string[] = [];
    try {
      for (const object of objects) {
        await this.storage.put(object);
        writtenKeys.push(object.key);
      }
    } catch (error) {
      await this.removeObjects(writtenKeys);
      throw error;
    }
  }
}
