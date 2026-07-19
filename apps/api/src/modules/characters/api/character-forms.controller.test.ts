import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharactersModule } from "../characters.module.js";

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [{ provide: StoragePort, useValue: storageStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
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

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(
  token: string,
  character: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({
    character: { name: "Paul Atreides", ...character },
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacterWithAppearance(token: string, bookId: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({
    character: { name: "Paul Atreides" },
    firstAppearance: { bookId, bookProfile: { importance: "central" } },
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function insertMedia(userId: string, kind = "avatar"): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 100,
      kind,
      sizeBytes: 1234,
      storageKey: `media/${kind}/${randomUUID()}/image.webp`,
      userId,
      width: 100,
    },
  });
  return asset.id;
}

describe("character forms CRUD", () => {
  it("creates a form, lists it and surfaces it on the character details view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);

    const created = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      description: "The reborn phoenix host",
      formType: "reincarnation",
      name: "Dark Phoenix",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body).toMatchObject({
      characterId,
      description: "The reborn phoenix host",
      formType: "reincarnation",
      isSpoiler: false,
      name: "Dark Phoenix",
      portrait: null,
    });

    const list = await authed("get", `/api/characters/${characterId}/forms`, accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    expect(list.body.forms).toHaveLength(1);
    expect(list.body.forms[0].name).toBe("Dark Phoenix");

    const details = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(details.status).toBe(HttpStatus.OK);
    expect(details.body.forms).toHaveLength(1);
    expect(details.body.forms[0]).toMatchObject({
      formType: "reincarnation",
      name: "Dark Phoenix",
    });
  });

  it("orders forms by position then creation", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);

    for (const [name, position] of [
      ["Third", 2],
      ["First", 0],
      ["Second", 1],
    ] as const) {
      const res = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
        name,
        position,
      });
      expect(res.status).toBe(HttpStatus.CREATED);
    }

    const list = await authed("get", `/api/characters/${characterId}/forms`, accessToken);
    expect(list.body.forms.map((form: { name: string }) => form.name)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("rejects a duplicate normalized name for the same character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);

    const first = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      name: "Dark Phoenix",
    });
    expect(first.status).toBe(HttpStatus.CREATED);

    const duplicate = await authed(
      "post",
      `/api/characters/${characterId}/forms`,
      accessToken,
    ).send({ name: "  dark phoenix  " });
    expect(duplicate.status).toBe(HttpStatus.CONFLICT);
    expect(duplicate.body.code).toBe("character_form_duplicate_name");
  });

  it("updates a form and reflects the change on the details view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);
    const created = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      name: "Alter Ego",
    });
    const formId = created.body.id;

    const patched = await authed(
      "patch",
      `/api/characters/${characterId}/forms/${formId}`,
      accessToken,
    ).send({ formType: "alter_ego", isSpoiler: true, name: "Secret Identity", position: 5 });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body).toMatchObject({
      formType: "alter_ego",
      isSpoiler: true,
      name: "Secret Identity",
      position: 5,
    });

    const details = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(details.body.forms[0]).toMatchObject({ isSpoiler: true, name: "Secret Identity" });
  });

  it("deletes a form and removes it from the details view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);
    const created = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      name: "Temporary Shape",
    });
    const formId = created.body.id;

    const deleted = await authed(
      "delete",
      `/api/characters/${characterId}/forms/${formId}`,
      accessToken,
    );
    expect(deleted.status).toBe(HttpStatus.NO_CONTENT);

    const list = await authed("get", `/api/characters/${characterId}/forms`, accessToken);
    expect(list.body.forms).toHaveLength(0);

    const details = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(details.body.forms).toHaveLength(0);
  });

  it("returns an empty forms array for a character that has none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);

    const details = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(details.status).toBe(HttpStatus.OK);
    expect(details.body.forms).toEqual([]);
  });
});

describe("character forms spoiler masking", () => {
  it("masks a spoiler form in the reading-context view but keeps it in the full owner view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createCharacterWithAppearance(accessToken, bookId);

    await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      formType: "transformation",
      name: "Public Form",
    });
    const secret = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      formType: "true_form",
      isSpoiler: true,
      name: "True Form Reveal",
    });
    expect(secret.status).toBe(HttpStatus.CREATED);

    const full = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(full.body.forms).toHaveLength(2);
    expect(full.body.forms.some((form: { isSpoiler: boolean }) => form.isSpoiler)).toBe(true);
    expect(JSON.stringify(full.body)).toContain("True Form Reveal");

    const masked = await authed(
      "get",
      `/api/characters/${characterId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(masked.status).toBe(HttpStatus.OK);
    expect(masked.body.forms).toHaveLength(1);
    expect(masked.body.forms[0].name).toBe("Public Form");
    expect(JSON.stringify(masked.body)).not.toContain("True Form Reveal");
  });
});

describe("character forms ownership (IDOR)", () => {
  it("returns 404 for a foreign or missing character without leaking existence", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const characterId = await createCharacter(owner.accessToken);
    const created = await authed(
      "post",
      `/api/characters/${characterId}/forms`,
      owner.accessToken,
    ).send({ name: "Owner Form" });
    const formId = created.body.id;

    const foreignCreate = await authed(
      "post",
      `/api/characters/${characterId}/forms`,
      intruder.accessToken,
    ).send({ name: "Intruder Form" });
    expect(foreignCreate.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignCreate.body.code).toBe("character_form_character_not_found");

    const foreignList = await authed(
      "get",
      `/api/characters/${characterId}/forms`,
      intruder.accessToken,
    );
    expect(foreignList.status).toBe(HttpStatus.NOT_FOUND);

    const foreignUpdate = await authed(
      "patch",
      `/api/characters/${characterId}/forms/${formId}`,
      intruder.accessToken,
    ).send({ name: "Hijacked" });
    expect(foreignUpdate.status).toBe(HttpStatus.NOT_FOUND);

    const foreignDelete = await authed(
      "delete",
      `/api/characters/${characterId}/forms/${formId}`,
      intruder.accessToken,
    );
    expect(foreignDelete.status).toBe(HttpStatus.NOT_FOUND);

    const missingCharacter = await authed(
      "get",
      `/api/characters/${MISSING_ID}/forms`,
      owner.accessToken,
    );
    expect(missingCharacter.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 when the form belongs to a different owned character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterA = await createCharacter(accessToken, { name: "Character A" });
    const characterB = await createCharacter(accessToken, { name: "Character B" });
    const created = await authed("post", `/api/characters/${characterA}/forms`, accessToken).send({
      name: "A Form",
    });
    const formId = created.body.id;

    const crossed = await authed(
      "patch",
      `/api/characters/${characterB}/forms/${formId}`,
      accessToken,
    ).send({ name: "Wrong parent" });
    expect(crossed.status).toBe(HttpStatus.NOT_FOUND);
    expect(crossed.body.code).toBe("character_form_not_found");
  });
});

describe("character forms media handling", () => {
  it("rejects a foreign or missing portrait media and creates nothing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);

    const res = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      name: "Media Form",
      portraitMediaId: MISSING_ID,
    });
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("media_ownership_mismatch");
    expect(await prisma.characterForm.count({ where: { character: { userId } } })).toBe(0);
  });

  it("deletes an orphaned portrait on form delete but keeps shared media", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);
    const orphanMediaId = await insertMedia(userId);
    const sharedMediaId = await insertMedia(userId);

    const orphanForm = await authed(
      "post",
      `/api/characters/${characterId}/forms`,
      accessToken,
    ).send({ name: "Orphan Portrait Form", portraitMediaId: orphanMediaId });
    expect(orphanForm.status).toBe(HttpStatus.CREATED);
    expect(orphanForm.body.portrait).toMatchObject({ id: orphanMediaId });

    const sharedForm = await authed(
      "post",
      `/api/characters/${characterId}/forms`,
      accessToken,
    ).send({ name: "Shared Portrait Form", portraitMediaId: sharedMediaId });
    expect(sharedForm.status).toBe(HttpStatus.CREATED);

    await authed("patch", `/api/characters/${characterId}`, accessToken)
      .send({ avatarMediaId: sharedMediaId })
      .expect(HttpStatus.OK);

    await authed(
      "delete",
      `/api/characters/${characterId}/forms/${orphanForm.body.id}`,
      accessToken,
    ).expect(HttpStatus.NO_CONTENT);
    await authed(
      "delete",
      `/api/characters/${characterId}/forms/${sharedForm.body.id}`,
      accessToken,
    ).expect(HttpStatus.NO_CONTENT);

    expect(await prisma.mediaAsset.count({ where: { id: orphanMediaId } })).toBe(0);
    expect(await prisma.mediaAsset.count({ where: { id: sharedMediaId } })).toBe(1);
  });

  it("cleans up the previous portrait when it is replaced on update", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter(accessToken);
    const oldMediaId = await insertMedia(userId);

    const created = await authed("post", `/api/characters/${characterId}/forms`, accessToken).send({
      name: "Replaceable",
      portraitMediaId: oldMediaId,
    });
    const formId = created.body.id;

    const patched = await authed(
      "patch",
      `/api/characters/${characterId}/forms/${formId}`,
      accessToken,
    ).send({ portraitMediaId: null });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body.portrait).toBeNull();

    expect(await prisma.mediaAsset.count({ where: { id: oldMediaId } })).toBe(0);
  });
});
