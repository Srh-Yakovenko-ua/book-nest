import { MEDIA_MAX_UPLOAD_BYTES } from "@app/shared";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ImageProcessorPort, ProcessedImage } from "../domain/image-processor.port.js";
import type { StoragePort } from "../domain/storage.port.js";
import type { MediaRepository } from "../infrastructure/media.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { MediaService } from "./media.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let pngBuffer: Buffer;

beforeAll(async () => {
  pngBuffer = await sharp({
    create: { background: { b: 80, g: 120, r: 200 }, channels: 3, height: 90, width: 60 },
  })
    .png()
    .toBuffer();
});

function buildService(): {
  imageProcessor: { process: ReturnType<typeof vi.fn> };
  repository: {
    create: ReturnType<typeof vi.fn>;
    deleteOwned: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
  };
  service: MediaService;
  storage: {
    delete: ReturnType<typeof vi.fn>;
    publicUrl: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
} {
  const imageProcessor = { process: vi.fn().mockResolvedValue(processedImage()) };
  const repository = {
    create: vi
      .fn()
      .mockImplementation((data: MediaAssetModel) =>
        Promise.resolve({ ...data, createdAt: new Date("2026-06-26T10:00:00.000Z") }),
      ),
    deleteOwned: vi.fn().mockResolvedValue(1),
    findOwnedById: vi.fn(),
  };
  const storage = {
    delete: vi.fn().mockResolvedValue(undefined),
    publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MediaService(
    imageProcessor as unknown as ImageProcessorPort,
    repository as unknown as MediaRepository,
    storage as unknown as StoragePort,
  );
  return { imageProcessor, repository, service, storage };
}

function processedImage(): ProcessedImage {
  return {
    contentType: "image/webp",
    derivatives: [
      { body: Buffer.from("thumb"), height: 300, name: "thumb", width: 200 },
      { body: Buffer.from("card"), height: 600, name: "card", width: 400 },
      { body: Buffer.from("full"), height: 1200, name: "full", width: 800 },
    ],
    height: 1200,
    original: Buffer.from("original"),
    width: 800,
  };
}

describe("MediaService.upload", () => {
  it("processes the image, stores original plus derivatives, and returns a MediaView", async () => {
    const { repository, service, storage } = buildService();

    const result = await service.upload(USER_ID, "book_cover", {
      buffer: pngBuffer,
      size: pngBuffer.length,
    });

    expect(storage.put).toHaveBeenCalledTimes(4);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/webp",
        height: 1200,
        kind: "book_cover",
        sizeBytes: pngBuffer.length,
        userId: USER_ID,
        width: 800,
      }),
    );
    expect(result.id).toMatch(UUID);
    expect(result.kind).toBe("book_cover");
    expect(result.width).toBe(800);
    expect(result.height).toBe(1200);
    expect(result.urls.full).toMatch(/^https:\/\/cdn\.test\/media\/book_cover\/.+\/full\.webp$/);
    expect(result.urls.card).toMatch(/\/card\.webp$/);
    expect(result.urls.thumb).toMatch(/\/thumb\.webp$/);
  });

  it("rejects a file larger than the max upload size before processing", async () => {
    const { imageProcessor, service } = buildService();

    await expect(
      service.upload(USER_ID, "book_cover", {
        buffer: Buffer.alloc(1),
        size: MEDIA_MAX_UPLOAD_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(imageProcessor.process).not.toHaveBeenCalled();
  });

  it("rejects a buffer whose magic bytes are not an allowed image type", async () => {
    const { imageProcessor, service } = buildService();
    const notAnImage = Buffer.from("this is plain text, not an image");

    await expect(
      service.upload(USER_ID, "book_cover", { buffer: notAnImage, size: notAnImage.length }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(imageProcessor.process).not.toHaveBeenCalled();
  });

  it("maps a processing failure to a BadRequestError", async () => {
    const { imageProcessor, service, storage } = buildService();
    imageProcessor.process.mockRejectedValue(new Error("sharp blew up"));

    await expect(
      service.upload(USER_ID, "book_cover", { buffer: pngBuffer, size: pngBuffer.length }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(storage.put).not.toHaveBeenCalled();
  });
});

describe("MediaService.delete", () => {
  it("deletes the stored objects and the row when the asset is owned", async () => {
    const { repository, service, storage } = buildService();
    repository.findOwnedById.mockResolvedValue({
      derivatives: {
        card: "media/book_cover/x/card.webp",
        full: "media/book_cover/x/full.webp",
        thumb: "media/book_cover/x/thumb.webp",
      },
      originalKey: "media/book_cover/x/original.png",
    });

    await service.delete(USER_ID, ASSET_ID);

    expect(storage.delete).toHaveBeenCalledWith([
      "media/book_cover/x/original.png",
      "media/book_cover/x/thumb.webp",
      "media/book_cover/x/card.webp",
      "media/book_cover/x/full.webp",
    ]);
    expect(repository.deleteOwned).toHaveBeenCalledWith(USER_ID, ASSET_ID);
  });

  it("throws NotFoundError when the asset is not owned", async () => {
    const { repository, service, storage } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    await expect(service.delete(USER_ID, ASSET_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
