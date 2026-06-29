import { MEDIA_MAX_UPLOAD_BYTES } from "@app/shared";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { ImageProcessorPort, ProcessedImageSet } from "../domain/image-processor.port.js";
import type { StoragePort } from "../domain/storage.port.js";
import type { MediaRepository } from "../infrastructure/media.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { CropOutOfBoundsError, ImageTooLargeError } from "../domain/image-processor.port.js";
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

function assetModel(overrides: Partial<MediaAssetModel> = {}): MediaAssetModel {
  return {
    contentType: "image/webp",
    createdAt: new Date("2026-06-26T10:00:00.000Z"),
    height: 1200,
    id: ASSET_ID,
    kind: "book_cover",
    originalName: "cover.png",
    sizeBytes: 1234,
    storageKey: "media/book_cover/abc/image.webp",
    thumbGeneratedAt: null,
    userId: USER_ID,
    width: 800,
    ...overrides,
  };
}

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
  const imageProcessor = { process: vi.fn().mockResolvedValue(processedImages()) };
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

function processedImages(): ProcessedImageSet {
  return {
    full: {
      body: Buffer.from("full-webp-image"),
      contentType: "image/webp",
      height: 1200,
      width: 800,
    },
    thumb: { body: Buffer.from("thumb-webp"), contentType: "image/webp", height: 300, width: 200 },
  };
}

describe("MediaService.upload", () => {
  it("processes the image, stores the image plus a thumb, and returns a MediaView with metadata", async () => {
    const { repository, service, storage } = buildService();
    const images = processedImages();
    const totalBytes = images.full.body.length + images.thumb.body.length;

    const result = await service.upload({
      file: {
        buffer: pngBuffer,
        originalName: "My Cover.PNG",
        size: pngBuffer.length,
      },
      kind: "book_cover",
      userId: USER_ID,
    });

    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/webp",
        height: 1200,
        kind: "book_cover",
        originalName: "My Cover.PNG",
        sizeBytes: totalBytes,
        thumbGeneratedAt: expect.any(Date),
        userId: USER_ID,
        width: 800,
      }),
    );
    expect(result.id).toMatch(UUID);
    expect(result.kind).toBe("book_cover");
    expect(result.width).toBe(800);
    expect(result.height).toBe(1200);
    expect(result.name).toBe("My Cover.PNG");
    expect(result.contentType).toBe("image/webp");
    expect(result.sizeBytes).toBe(totalBytes);
    expect(typeof result.createdAt).toBe("string");
    expect(result.urls.full).toMatch(/^https:\/\/cdn\.test\/media\/book_cover\/.+\/image\.webp$/);
    expect(result.urls.card).toBe(result.urls.full);
    expect(result.urls.thumb).toMatch(/^https:\/\/cdn\.test\/media\/book_cover\/.+\/thumb\.webp$/);
    expect(result.urls.thumb).not.toBe(result.urls.full);
  });

  it("forwards the crop rectangle to the image processor", async () => {
    const { imageProcessor, service } = buildService();
    const crop = { height: 1600, width: 1200, x: 0, y: 0 };

    await service.upload({
      crop,
      file: { buffer: pngBuffer, originalName: "cover.png", size: pngBuffer.length },
      kind: "book_cover",
      userId: USER_ID,
    });

    expect(imageProcessor.process).toHaveBeenCalledWith({ crop, input: pngBuffer });
  });

  it("maps a crop-out-of-bounds failure to a BadRequestError", async () => {
    const { imageProcessor, service, storage } = buildService();
    imageProcessor.process.mockRejectedValue(new CropOutOfBoundsError());

    await expect(
      service.upload({
        crop: { height: 9000, width: 9000, x: 0, y: 0 },
        file: { buffer: pngBuffer, originalName: "cover.png", size: pngBuffer.length },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("maps an image-too-large failure to a BadRequestError without storing", async () => {
    const { imageProcessor, service, storage } = buildService();
    imageProcessor.process.mockRejectedValue(new ImageTooLargeError());

    await expect(
      service.upload({
        file: { buffer: pngBuffer, originalName: "huge.png", size: pngBuffer.length },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("normalizes a missing original filename to null", async () => {
    const { repository, service } = buildService();

    const result = await service.upload({
      file: {
        buffer: pngBuffer,
        originalName: "   ",
        size: pngBuffer.length,
      },
      kind: "book_cover",
      userId: USER_ID,
    });

    expect(result.name).toBeNull();
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ originalName: null }));
  });

  it("strips control characters from the original filename", async () => {
    const { service } = buildService();
    const messyName = `cover${String.fromCharCode(1, 13, 10)}.png`;

    const result = await service.upload({
      file: {
        buffer: pngBuffer,
        originalName: messyName,
        size: pngBuffer.length,
      },
      kind: "book_cover",
      userId: USER_ID,
    });

    expect(result.name).toBe("cover.png");
  });

  it("removes every stored object when persisting the asset fails after upload", async () => {
    const { repository, service, storage } = buildService();
    repository.create.mockRejectedValue(new Error("db down"));

    await expect(
      service.upload({
        file: {
          buffer: pngBuffer,
          originalName: "cover.png",
          size: pngBuffer.length,
        },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toThrow("db down");

    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    const deletedKeys: unknown = storage.delete.mock.calls[0]?.[0];
    expect(deletedKeys).toEqual([
      expect.stringMatching(/\/image\.webp$/),
      expect.stringMatching(/\/thumb\.webp$/),
    ]);
  });

  it("rejects a file larger than the max upload size before processing", async () => {
    const { imageProcessor, service } = buildService();

    await expect(
      service.upload({
        file: {
          buffer: Buffer.alloc(1),
          originalName: "huge.png",
          size: MEDIA_MAX_UPLOAD_BYTES + 1,
        },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(imageProcessor.process).not.toHaveBeenCalled();
  });

  it("rejects a buffer whose magic bytes are not an allowed image type", async () => {
    const { imageProcessor, service } = buildService();
    const notAnImage = Buffer.from("this is plain text, not an image");

    await expect(
      service.upload({
        file: {
          buffer: notAnImage,
          originalName: "note.txt",
          size: notAnImage.length,
        },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(imageProcessor.process).not.toHaveBeenCalled();
  });

  it("maps a processing failure to a BadRequestError", async () => {
    const { imageProcessor, service, storage } = buildService();
    imageProcessor.process.mockRejectedValue(new Error("sharp blew up"));

    await expect(
      service.upload({
        file: {
          buffer: pngBuffer,
          originalName: "cover.png",
          size: pngBuffer.length,
        },
        kind: "book_cover",
        userId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(storage.put).not.toHaveBeenCalled();
  });
});

describe("MediaService.buildView", () => {
  it("returns the original image for every url when the asset has no generated thumb (legacy)", () => {
    const { service } = buildService();
    const asset = assetModel({ thumbGeneratedAt: null });

    const view = service.buildView(asset);

    const expected = `https://cdn.test/${asset.storageKey}`;
    expect(view.urls.full).toBe(expected);
    expect(view.urls.card).toBe(expected);
    expect(view.urls.thumb).toBe(expected);
  });

  it("serves the sibling thumb object only for the thumb url when a thumb was generated", () => {
    const { service } = buildService();
    const asset = assetModel({
      storageKey: "media/book_cover/abc/image.webp",
      thumbGeneratedAt: new Date("2026-06-26T10:00:00.000Z"),
    });

    const view = service.buildView(asset);

    expect(view.urls.full).toBe("https://cdn.test/media/book_cover/abc/image.webp");
    expect(view.urls.card).toBe(view.urls.full);
    expect(view.urls.thumb).toBe("https://cdn.test/media/book_cover/abc/thumb.webp");
    expect(view.urls.thumb).not.toBe(view.urls.full);
  });
});

describe("MediaService.delete", () => {
  it("deletes the image and the thumb object for a modern asset", async () => {
    const { repository, service, storage } = buildService();
    repository.findOwnedById.mockResolvedValue(
      assetModel({
        storageKey: "media/book_cover/x/image.webp",
        thumbGeneratedAt: new Date("2026-06-26T10:00:00.000Z"),
      }),
    );

    await service.delete({ id: ASSET_ID, userId: USER_ID });

    expect(storage.delete).toHaveBeenCalledWith([
      "media/book_cover/x/image.webp",
      "media/book_cover/x/thumb.webp",
    ]);
    expect(repository.deleteOwned).toHaveBeenCalledWith({ id: ASSET_ID, userId: USER_ID });
  });

  it("deletes only the image object for a legacy asset without a generated thumb", async () => {
    const { repository, service, storage } = buildService();
    repository.findOwnedById.mockResolvedValue(
      assetModel({ storageKey: "media/book_cover/x/image.webp", thumbGeneratedAt: null }),
    );

    await service.delete({ id: ASSET_ID, userId: USER_ID });

    expect(storage.delete).toHaveBeenCalledWith(["media/book_cover/x/image.webp"]);
  });

  it("throws NotFoundError when the asset is not owned", async () => {
    const { repository, service, storage } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    await expect(service.delete({ id: ASSET_ID, userId: USER_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
