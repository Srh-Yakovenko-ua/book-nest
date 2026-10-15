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

type GroupDetailsBody = {
  memberCount: number;
  members: { characterId: string; characterName: string }[];
};

type SeriesSetup = { firstBook: string; secondBook: string; seriesId: string };

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

async function addCharacter({
  bookId,
  name,
  profile,
  token,
}: {
  bookId: string;
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central", ...profile },
    character: { name },
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function authed(method: "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createGroupWithMembers(token: string, characterIds: string[]): Promise<string> {
  const res = await authed("post", "/api/character-groups", token).send({
    members: characterIds.map((characterId) => ({ characterId })),
    name: "The Fremen",
    type: "order",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeries(token: string): Promise<SeriesSetup> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: "Dune Saga" },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  const seriesId = res.body.series.id;
  const secondBook = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId,
    title: "Dune Messiah",
  });
  expect(secondBook.status).toBe(HttpStatus.CREATED);
  return { firstBook: res.body.id, secondBook: secondBook.body.id, seriesId };
}

async function groupDetails(token: string, groupId: string, query = ""): Promise<GroupDetailsBody> {
  const res = await authed("get", `/api/character-groups/${groupId}${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("character group details in a reading context", () => {
  it("keeps members whatever their first-appearance chapter, page or audio position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const memberIds: string[] = [];
    for (const seed of [
      { name: "Duncan Idaho", profile: { firstAppearanceChapter: "2" } },
      { name: "Alia Atreides", profile: { firstAppearanceChapter: "40" } },
      { name: "Hayt", profile: { firstAppearancePage: 420 } },
      { name: "Scytale", profile: { firstAppearanceAudioSeconds: 36000 } },
    ]) {
      memberIds.push(
        await addCharacter({
          bookId: secondBook,
          name: seed.name,
          profile: seed.profile,
          token: accessToken,
        }),
      );
    }
    const groupId = await createGroupWithMembers(accessToken, memberIds);

    const details = await groupDetails(accessToken, groupId, `?contextBookId=${secondBook}`);

    expect(details.memberCount).toBe(4);
    expect(details.members.map((member) => member.characterName).sort()).toEqual([
      "Alia Atreides",
      "Duncan Idaho",
      "Hayt",
      "Scytale",
    ]);
  });

  it("keeps an earlier part's member visible from a later part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const earlierPart = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [earlierPart]);

    const details = await groupDetails(accessToken, groupId, `?contextBookId=${secondBook}`);

    expect(details.memberCount).toBe(1);
    expect(details.members.map((member) => member.characterName)).toEqual(["Paul Atreides"]);
  });

  it("hides a future part's member while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const futurePart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [futurePart]);

    const gated = await groupDetails(accessToken, groupId, `?contextBookId=${firstBook}`);
    expect(gated.memberCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const full = await groupDetails(accessToken, groupId);
    expect(full.memberCount).toBe(1);
    expect(full.members.map((member) => member.characterName)).toEqual(["Alia Atreides"]);
  });

  it("leaves a request with no context book untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook } = await createSeries(accessToken);
    const earlierPart = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    const futurePart = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [earlierPart, futurePart]);

    const full = await groupDetails(accessToken, groupId);
    expect(full.memberCount).toBe(2);
    expect(full.members.map((member) => member.characterName).sort()).toEqual([
      "Alia Atreides",
      "Paul Atreides",
    ]);
  });
});
