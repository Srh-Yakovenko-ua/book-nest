import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import sharp from "sharp";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { MEDIA_QUEUE_NAME } from "../../media/domain/media-queue.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { MediaModule } from "../../media/media.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

const queueStub = { add: (): Promise<void> => Promise.resolve() };

let context: AuthTestContext;
let app: INestApplication;
let pngBuffer: Buffer;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, MediaModule],
    [
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(MEDIA_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  pngBuffer = await sharp({
    create: { background: { b: 80, g: 120, r: 200 }, channels: 3, height: 90, width: 60 },
  })
    .png()
    .toBuffer();
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function uploadCover(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .post("/api/media")
    .set("Authorization", `Bearer ${accessToken}`)
    .attach("file", pngBuffer, { contentType: "image/png", filename: "cover.png" });
}

describe("Book cover integration", () => {
  it("attaches an uploaded cover on create and returns it in the BookView", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const media = await uploadCover(accessToken);

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      coverMediaId: media.body.id,
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.cover.id).toBe(media.body.id);
    expect(res.body.cover.urls.full).toMatch(/\/image\.webp$/);
    expect(res.body.cover.width).toBe(60);
  });

  it("returns null cover when none is attached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.cover).toBeNull();
  });

  it("rejects a cover owned by another user with 404", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerMedia = await uploadCover(stranger.accessToken);

    const res = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      coverMediaId: strangerMedia.body.id,
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent cover media id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      coverMediaId: MISSING_UUID,
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });

  it("sets and then clears the cover via update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const media = await uploadCover(accessToken);
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.cover).toBeNull();

    const set = await request(app.getHttpServer())
      .patch(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ coverMediaId: media.body.id });
    expect(set.status).toBe(200);
    expect(set.body.cover.id).toBe(media.body.id);

    const cleared = await request(app.getHttpServer())
      .patch(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ coverMediaId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.cover).toBeNull();
  });

  it("refuses to delete a media asset a book still uses as its cover", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const media = await uploadCover(accessToken);
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      coverMediaId: media.body.id,
      title: "Dune",
    });
    expect(created.body.cover.id).toBe(media.body.id);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/media/${media.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(409);

    const refetched = await request(app.getHttpServer())
      .get(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(refetched.status).toBe(200);
    expect(refetched.body.cover.id).toBe(media.body.id);
  });

  it("cleans the media asset up by itself once the book stops using it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const media = await uploadCover(accessToken);
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      coverMediaId: media.body.id,
      title: "Dune",
    });

    const cleared = await request(app.getHttpServer())
      .patch(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ coverMediaId: null });
    expect(cleared.status).toBe(200);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/media/${media.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleted.status).toBe(404);
  });
});
