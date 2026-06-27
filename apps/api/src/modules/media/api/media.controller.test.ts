import type { INestApplication } from "@nestjs/common";

import { MEDIA_MAX_UPLOAD_BYTES } from "@app/shared";
import sharp from "sharp";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StoragePort } from "../domain/storage.port.js";
import { MediaModule } from "../media.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const MEDIA_VIEW_KEYS = [
  "contentType",
  "createdAt",
  "height",
  "id",
  "kind",
  "name",
  "sizeBytes",
  "urls",
  "width",
];

const storedKeys = new Set<string>();
const deletedBatches: string[][] = [];

const storageStub = {
  delete: (keys: string[]): Promise<void> => {
    deletedBatches.push(keys);
    for (const key of keys) storedKeys.delete(key);
    return Promise.resolve();
  },
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (object: { key: string }): Promise<void> => {
    storedKeys.add(object.key);
    return Promise.resolve();
  },
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let pngBuffer: Buffer;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, MediaModule],
    [{ provide: StoragePort, useValue: storageStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  pngBuffer = await sharp({
    create: { background: { b: 80, g: 120, r: 200 }, channels: 3, height: 90, width: 60 },
  })
    .png()
    .toBuffer();
});

beforeEach(() => {
  context.reset();
  storedKeys.clear();
  deletedBatches.length = 0;
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function uploadMedia(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .post("/api/media")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/media", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/media")
      .attach("file", pngBuffer, { contentType: "image/png", filename: "cover.png" });

    expect(res.status).toBe(401);
  });

  it("uploads an image, stores a single object, and returns a MediaView with metadata", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await uploadMedia(accessToken).attach("file", pngBuffer, {
      contentType: "image/png",
      filename: "cover.png",
    });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(MEDIA_VIEW_KEYS);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.kind).toBe("book_cover");
    expect(res.body.width).toBe(60);
    expect(res.body.height).toBe(90);
    expect(res.body.name).toBe("cover.png");
    expect(res.body.contentType).toBe("image/webp");
    expect(typeof res.body.sizeBytes).toBe("number");
    expect(typeof res.body.createdAt).toBe("string");
    expect(res.body.urls.full).toMatch(/\/image\.webp$/);
    expect(res.body.urls.card).toBe(res.body.urls.full);
    expect(res.body.urls.thumb).toBe(res.body.urls.full);
    expect(storedKeys.size).toBe(1);

    const row = await prisma.mediaAsset.findUnique({ where: { id: res.body.id } });
    expect(row?.userId).toBe(userId);
    expect(row?.kind).toBe("book_cover");
    expect(row?.originalName).toBe("cover.png");
  });

  it("accepts an explicit kind field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await uploadMedia(accessToken)
      .field("kind", "avatar")
      .attach("file", pngBuffer, { contentType: "image/png", filename: "avatar.png" });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("avatar");
  });

  it("returns 400 when the file is not an allowed image type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await uploadMedia(accessToken).attach("file", Buffer.from("not an image"), {
      contentType: "text/plain",
      filename: "note.txt",
    });

    expect(res.status).toBe(400);
  });

  it("returns 413 when the file exceeds the max upload size", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await uploadMedia(accessToken).attach(
      "file",
      Buffer.alloc(MEDIA_MAX_UPLOAD_BYTES + 1024),
      { contentType: "image/png", filename: "huge.png" },
    );

    expect(res.status).toBe(413);
  });

  it("returns 400 when no file is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await uploadMedia(accessToken).field("kind", "book_cover");

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/media/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/media/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("deletes the caller's own asset and its stored objects", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await uploadMedia(accessToken).attach("file", pngBuffer, {
      contentType: "image/png",
      filename: "cover.png",
    });
    expect(storedKeys.size).toBe(1);

    const res = await request(app.getHttpServer())
      .delete(`/api/media/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(storedKeys.size).toBe(0);
    expect(deletedBatches).toHaveLength(1);
    expect(deletedBatches[0]).toHaveLength(1);
    const row = await prisma.mediaAsset.findUnique({ where: { id: created.body.id } });
    expect(row).toBeNull();
  });

  it("returns 404 for a non-existent asset id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .delete(`/api/media/${MISSING_UUID}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another user's asset and leaves it intact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const created = await uploadMedia(stranger.accessToken).attach("file", pngBuffer, {
      contentType: "image/png",
      filename: "cover.png",
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/media/${created.body.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(404);
    const row = await prisma.mediaAsset.findUnique({ where: { id: created.body.id } });
    expect(row).not.toBeNull();
  });
});
