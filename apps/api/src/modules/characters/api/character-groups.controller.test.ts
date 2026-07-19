import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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
  method: "delete" | "get" | "patch" | "post" | "put",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "George R. R. Martin" }],
    ownershipStatus: "owned",
    title: "A Game of Thrones",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character: { name } });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacterInBook(
  token: string,
  bookId: string,
  name: string,
  profile: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central", ...profile },
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createGroup(
  token: string,
  body: Record<string, unknown> = {},
): Promise<request.Response> {
  return authed("post", "/api/character-groups", token).send({
    name: "House Stark",
    type: "house",
    ...body,
  });
}

describe("character group CRUD", () => {
  it("creates a group and reads it back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const created = await createGroup(accessToken, {
      description: "Winter is coming",
      type: "house",
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.id).toMatch(UUID);
    expect(created.body).toMatchObject({
      description: "Winter is coming",
      hiddenFields: [],
      isSpoiler: false,
      memberCount: 0,
      name: "House Stark",
      type: "house",
    });
    expect(created.body.members).toEqual([]);

    const read = await authed("get", `/api/character-groups/${created.body.id}`, accessToken);
    expect(read.status).toBe(HttpStatus.OK);
    expect(read.body.name).toBe("House Stark");
  });

  it("creates a group with initial members atomically", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const ned = await createCharacterInBook(accessToken, bookId, "Eddard Stark");
    const arya = await createCharacter(accessToken, "Arya Stark");

    const created = await createGroup(accessToken, {
      members: [
        { characterId: ned, role: "Lord", status: "dead" },
        { bookId, characterId: arya, role: "Daughter" },
      ],
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.memberCount).toBe(2);
    const memberIds = created.body.members.map(
      (member: { characterId: string }) => member.characterId,
    );
    expect(memberIds).toEqual(expect.arrayContaining([ned, arya]));
    const nedMember = created.body.members.find(
      (member: { characterId: string }) => member.characterId === ned,
    );
    expect(nedMember).toMatchObject({
      characterName: "Eddard Stark",
      role: "Lord",
      status: "dead",
    });
  });

  it("requires customType when type is custom", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const missing = await createGroup(accessToken, { customType: "", type: "custom" });
    expect(missing.status).toBe(HttpStatus.BAD_REQUEST);

    const provided = await createGroup(accessToken, { customType: "Secret cabal", type: "custom" });
    expect(provided.status).toBe(HttpStatus.CREATED);
    expect(provided.body.customType).toBe("Secret cabal");
  });

  it("lists groups filtered by series, type and search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesBook = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      newSeries: { name: "A Song of Ice and Fire" },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "A Game of Thrones",
    });
    expect(seriesBook.status).toBe(HttpStatus.CREATED);
    const seriesId = seriesBook.body.series.id;

    await createGroup(accessToken, { name: "House Stark", seriesId, type: "house" });
    await createGroup(accessToken, { name: "House Lannister", type: "house" });
    await createGroup(accessToken, { name: "Night's Watch", type: "order" });

    const byType = await authed("get", "/api/character-groups?type=house", accessToken);
    expect(byType.status).toBe(HttpStatus.OK);
    expect(byType.body.totalCount).toBe(2);

    const bySeries = await authed("get", `/api/character-groups?seriesId=${seriesId}`, accessToken);
    expect(bySeries.body.totalCount).toBe(1);
    expect(bySeries.body.items[0].name).toBe("House Stark");

    const bySearch = await authed("get", "/api/character-groups?q=night", accessToken);
    expect(bySearch.body.totalCount).toBe(1);
    expect(bySearch.body.items[0].name).toBe("Night's Watch");
  });

  it("updates a group and clears customType when leaving the custom type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createGroup(accessToken, { customType: "Cabal", type: "custom" });
    const groupId = created.body.id;

    const patched = await authed("patch", `/api/character-groups/${groupId}`, accessToken).send({
      description: "Sworn brothers",
      name: "The Night's Watch",
      type: "order",
    });
    expect(patched.status).toBe(HttpStatus.OK);
    expect(patched.body).toMatchObject({
      customType: null,
      description: "Sworn brothers",
      name: "The Night's Watch",
      type: "order",
    });
  });

  it("rejects clearing customType while the stored type stays custom", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createGroup(accessToken, { customType: "Cabal", type: "custom" });
    const groupId = created.body.id;

    const res = await authed("patch", `/api/character-groups/${groupId}`, accessToken).send({
      customType: "",
    });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("validation_failed");
  });

  it("deletes a group and cascades its memberships", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Jon Snow");
    const created = await createGroup(accessToken, {
      members: [{ characterId: character }],
    });
    const groupId = created.body.id;

    const removed = await authed("delete", `/api/character-groups/${groupId}`, accessToken);
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const read = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(read.status).toBe(HttpStatus.NOT_FOUND);

    const prisma = app.get(PrismaService);
    expect(await prisma.characterGroupMembership.count({ where: { group: { userId } } })).toBe(0);
  });
});

describe("character group membership", () => {
  it("upserts a membership idempotently without creating duplicates", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Sansa Stark");
    const created = await createGroup(accessToken);
    const groupId = created.body.id;

    const first = await authed(
      "put",
      `/api/character-groups/${groupId}/members/${character}`,
      accessToken,
    ).send({ role: "Lady" });
    expect(first.status).toBe(HttpStatus.OK);
    expect(first.body.memberCount).toBe(1);
    expect(first.body.members[0]).toMatchObject({ characterId: character, role: "Lady" });

    const second = await authed(
      "put",
      `/api/character-groups/${groupId}/members/${character}`,
      accessToken,
    ).send({ role: "Queen in the North" });
    expect(second.status).toBe(HttpStatus.OK);
    expect(second.body.memberCount).toBe(1);
    expect(second.body.members[0].role).toBe("Queen in the North");

    const prisma = app.get(PrismaService);
    expect(await prisma.characterGroupMembership.count({ where: { group: { userId } } })).toBe(1);
  });

  it("dedupes duplicate members supplied on create", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Bran Stark");

    const created = await createGroup(accessToken, {
      members: [
        { characterId: character, role: "Prince" },
        { characterId: character, role: "King" },
      ],
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    expect(created.body.memberCount).toBe(1);
    expect(created.body.members[0].role).toBe("Prince");
  });

  it("removes a character from a group", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const character = await createCharacter(accessToken, "Rickon Stark");
    const created = await createGroup(accessToken, { members: [{ characterId: character }] });
    const groupId = created.body.id;

    const removed = await authed(
      "delete",
      `/api/character-groups/${groupId}/members/${character}`,
      accessToken,
    );
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const read = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(read.body.memberCount).toBe(0);

    const removeAgain = await authed(
      "delete",
      `/api/character-groups/${groupId}/members/${character}`,
      accessToken,
    );
    expect(removeAgain.status).toBe(HttpStatus.NOT_FOUND);
    expect(removeAgain.body.code).toBe("character_group_membership_not_found");
  });
});

describe("character group ownership (IDOR)", () => {
  it("returns 404 for a foreign or missing group, member character, series and book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });

    const ownerGroup = await createGroup(owner.accessToken);
    const ownerGroupId = ownerGroup.body.id;
    const ownerCharacter = await createCharacter(owner.accessToken, "Eddard Stark");

    const foreignGet = await authed(
      "get",
      `/api/character-groups/${ownerGroupId}`,
      intruder.accessToken,
    );
    expect(foreignGet.status).toBe(HttpStatus.NOT_FOUND);

    const foreignPatch = await authed(
      "patch",
      `/api/character-groups/${ownerGroupId}`,
      intruder.accessToken,
    ).send({ name: "Hijacked" });
    expect(foreignPatch.status).toBe(HttpStatus.NOT_FOUND);

    const foreignDelete = await authed(
      "delete",
      `/api/character-groups/${ownerGroupId}`,
      intruder.accessToken,
    );
    expect(foreignDelete.status).toBe(HttpStatus.NOT_FOUND);

    const foreignMember = await authed(
      "put",
      `/api/character-groups/${ownerGroupId}/members/${ownerCharacter}`,
      intruder.accessToken,
    ).send({});
    expect(foreignMember.status).toBe(HttpStatus.NOT_FOUND);

    const missingSeries = await createGroup(owner.accessToken, { seriesId: MISSING_ID });
    expect(missingSeries.status).toBe(HttpStatus.NOT_FOUND);
    expect(missingSeries.body.code).toBe("character_group_series_not_found");

    const foreignCharacterMember = await authed(
      "put",
      `/api/character-groups/${ownerGroupId}/members/${MISSING_ID}`,
      owner.accessToken,
    ).send({});
    expect(foreignCharacterMember.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignCharacterMember.body.code).toBe("character_group_member_character_not_found");

    const foreignBookMember = await authed(
      "put",
      `/api/character-groups/${ownerGroupId}/members/${ownerCharacter}`,
      owner.accessToken,
    ).send({ bookId: MISSING_ID });
    expect(foreignBookMember.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignBookMember.body.code).toBe("character_group_book_not_found");
  });

  it("does not create a group when an initial member is foreign and rolls back", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const foreignCharacter = await createCharacter(intruder.accessToken, "Tyrion Lannister");

    const res = await createGroup(owner.accessToken, {
      members: [{ characterId: foreignCharacter }],
    });
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_group_member_character_not_found");

    const prisma = app.get(PrismaService);
    expect(await prisma.characterGroup.count({ where: { userId: owner.userId } })).toBe(0);
  });
});

describe("character group spoiler redaction", () => {
  it("hides spoiler memberships in a reading context but keeps them without one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const character = await createCharacterInBook(accessToken, bookId, "Eddard Stark");
    const created = await createGroup(accessToken);
    const groupId = created.body.id;

    await authed("put", `/api/character-groups/${groupId}/members/${character}`, accessToken).send({
      isSpoiler: true,
      role: "Warden",
    });

    const full = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(full.body.memberCount).toBe(1);

    const safe = await authed(
      "get",
      `/api/character-groups/${groupId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.status).toBe(HttpStatus.OK);
    expect(safe.body.memberCount).toBe(0);
    expect(safe.body.members).toEqual([]);
    expect(JSON.stringify(safe.body)).not.toContain("Warden");
  });

  it("hides members whose presence is a spoiler in the reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const visible = await createCharacterInBook(accessToken, bookId, "Eddard Stark");
    const hidden = await createCharacterInBook(accessToken, bookId, "The Traitor", {
      hidePresenceAsSpoiler: true,
    });
    const created = await createGroup(accessToken, {
      members: [{ characterId: visible }, { characterId: hidden }],
    });
    const groupId = created.body.id;

    const safe = await authed(
      "get",
      `/api/character-groups/${groupId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.body.memberCount).toBe(1);
    expect(safe.body.members[0].characterId).toBe(visible);
    expect(JSON.stringify(safe.body)).not.toContain("The Traitor");
  });

  it("keeps a profile-hidden member in the owner's views but drops it in a reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const visible = await createCharacter(accessToken, "Sansa Stark");
    const hiddenRes = await authed("post", "/api/characters", accessToken).send({
      character: { hideProfileAsSpoiler: true, name: "The Ghost Heir" },
    });
    expect(hiddenRes.status).toBe(HttpStatus.CREATED);
    const hidden = hiddenRes.body.id;

    const created = await createGroup(accessToken, {
      members: [{ characterId: visible }, { characterId: hidden }],
    });
    const groupId = created.body.id;
    expect(created.body.memberCount).toBe(2);

    const full = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(full.body.memberCount).toBe(2);
    const fullMemberIds = full.body.members.map(
      (member: { characterId: string }) => member.characterId,
    );
    expect(fullMemberIds).toEqual(expect.arrayContaining([visible, hidden]));

    const list = await authed("get", "/api/character-groups", accessToken);
    const listedGroup = list.body.items.find((group: { id: string }) => group.id === groupId);
    expect(listedGroup.memberCount).toBe(2);

    const safe = await authed(
      "get",
      `/api/character-groups/${groupId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.status).toBe(HttpStatus.OK);
    expect(safe.body.memberCount).toBe(1);
    expect(safe.body.members[0].characterId).toBe(visible);
    expect(JSON.stringify(safe.body)).not.toContain("The Ghost Heir");
  });

  it("masks a spoiler group name, description and customType in a reading context only", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const character = await createCharacterInBook(accessToken, bookId, "Eddard Stark");
    const created = await createGroup(accessToken, {
      customType: "Assassins guild",
      description: "They secretly rule the free cities",
      isSpoiler: true,
      members: [{ characterId: character }],
      name: "The Faceless Men",
      type: "custom",
    });
    const groupId = created.body.id;

    const full = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(full.body).toMatchObject({
      customType: "Assassins guild",
      description: "They secretly rule the free cities",
      hiddenFields: [],
      name: "The Faceless Men",
    });

    const safe = await authed(
      "get",
      `/api/character-groups/${groupId}?contextBookId=${bookId}`,
      accessToken,
    );
    expect(safe.body.name).toBeNull();
    expect(safe.body.description).toBeNull();
    expect(safe.body.customType).toBeNull();
    expect(safe.body.hiddenFields).toEqual(
      expect.arrayContaining(["customType", "description", "name"]),
    );
    const serialized = JSON.stringify(safe.body);
    expect(serialized).not.toContain("The Faceless Men");
    expect(serialized).not.toContain("secretly rule");
    expect(serialized).not.toContain("Assassins guild");
  });

  it("hides a global membership of a future hidden-presence character until it is reached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      newSeries: { name: "A Song of Ice and Fire" },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "A Game of Thrones",
    });
    expect(firstBook.status).toBe(HttpStatus.CREATED);
    const seriesId = firstBook.body.series.id;
    const firstBookId = firstBook.body.id;

    const secondBook = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      ownershipStatus: "owned",
      partNumber: 2,
      seriesId,
      title: "A Clash of Kings",
    });
    expect(secondBook.status).toBe(HttpStatus.CREATED);

    const hiddenHeir = await createCharacterInBook(
      accessToken,
      secondBook.body.id,
      "The Hidden Heir",
      {
        hidePresenceAsSpoiler: true,
      },
    );
    const created = await createGroup(accessToken, { members: [{ characterId: hiddenHeir }] });
    const groupId = created.body.id;

    const safe = await authed(
      "get",
      `/api/character-groups/${groupId}?contextBookId=${firstBookId}`,
      accessToken,
    );
    expect(safe.status).toBe(HttpStatus.OK);
    expect(safe.body.memberCount).toBe(0);
    expect(JSON.stringify(safe.body)).not.toContain("The Hidden Heir");

    const full = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(full.body.memberCount).toBe(1);
    expect(full.body.members[0].characterName).toBe("The Hidden Heir");
  });
});

describe("character group soft-deleted members", () => {
  it("excludes soft-deleted characters from the member listing and memberCount", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const staying = await createCharacter(accessToken, "Jon Snow");
    const leaving = await createCharacter(accessToken, "Robb Stark");
    const created = await createGroup(accessToken, {
      members: [{ characterId: staying }, { characterId: leaving }],
    });
    const groupId = created.body.id;
    expect(created.body.memberCount).toBe(2);

    const deleted = await authed("delete", `/api/characters/${leaving}?confirm=true`, accessToken);
    expect(deleted.status).toBe(HttpStatus.OK);

    const read = await authed("get", `/api/character-groups/${groupId}`, accessToken);
    expect(read.body.memberCount).toBe(1);
    expect(read.body.members).toHaveLength(1);
    expect(read.body.members[0].characterId).toBe(staying);
    expect(JSON.stringify(read.body)).not.toContain("Robb Stark");
  });
});
