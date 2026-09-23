import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
  app = context.app;
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

async function createBook(token: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook(
  token: string,
  bookId: string,
  name: string,
  bookProfile: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile,
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body;
}

async function readAppearance(
  token: string,
  bookId: string,
  characterId: string,
): Promise<Record<string, unknown>> {
  const res = await authed("get", `/api/books/${bookId}/characters/${characterId}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.appearances[0];
}

describe("unspecified character importance and status", () => {
  it("persists not_specified for a profile that omits importance and status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createInBook(accessToken, bookId, "Paul Atreides");

    const appearance = await readAppearance(accessToken, bookId, String(created.id));
    expect(appearance.importance).toBe("not_specified");
    expect(appearance.status).toBe("not_specified");
  });

  it("round-trips unknown as a real status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createInBook(accessToken, bookId, "Duncan Idaho", {
      status: "unknown",
    });

    const appearance = await readAppearance(accessToken, bookId, String(created.id));
    expect(appearance.status).toBe("unknown");
    expect(appearance.importance).toBe("not_specified");
  });

  it("keeps explicitly stored supporting and active values", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const created = await createInBook(accessToken, bookId, "Stilgar", {
      importance: "supporting",
      status: "active",
    });

    const appearance = await readAppearance(accessToken, bookId, String(created.id));
    expect(appearance.importance).toBe("supporting");
    expect(appearance.status).toBe("active");
  });

  it("switches an explicit importance back to not_specified on update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createInBook(accessToken, bookId, "Chani", { importance: "major" });

    const updated = await authed(
      "patch",
      `/api/books/${bookId}/characters/${String(created.id)}`,
      accessToken,
    ).send({ importance: "not_specified", status: "not_specified" });
    expect(updated.status).toBe(HttpStatus.OK);

    const appearance = await readAppearance(accessToken, bookId, String(created.id));
    expect(appearance.importance).toBe("not_specified");
    expect(appearance.status).toBe("not_specified");
  });

  it("counts unspecified characters in the total without exposing a not_specified bucket", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(accessToken, bookId, "Paul Atreides", { importance: "central" });
    await createInBook(accessToken, bookId, "Gurney Halleck", { importance: "supporting" });
    await createInBook(accessToken, bookId, "Shadout Mapes");

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.byImportance).toEqual({
      central: 1,
      episodic: 0,
      major: 0,
      mentioned: 0,
      supporting: 1,
    });
    expect(res.body.totalVisibleCharacters).toBe(3);
  });

  it("filters the global catalog by the unspecified importance", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await createInBook(accessToken, bookId, "Paul Atreides", { importance: "central" });
    await createInBook(accessToken, bookId, "Shadout Mapes");

    const res = await authed("get", "/api/characters?importance=not_specified", accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0].name).toBe("Shadout Mapes");
  });
});
