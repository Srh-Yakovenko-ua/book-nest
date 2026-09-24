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
  character,
  name,
  profile,
  token,
}: {
  bookId: string;
  character?: Record<string, unknown>;
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "central", ...profile },
    character: { name, ...character },
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

describe("character group details reading-position gating", () => {
  it("hides a member whose first appearance is in a later chapter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const early = await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [early, late]);

    const ungated = await groupDetails(accessToken, groupId, `?contextBookId=${secondBook}`);
    expect(ungated.memberCount).toBe(2);

    const gated = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(gated.memberCount).toBe(1);
    expect(gated.members.map((member) => member.characterId)).toEqual([early]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const reached = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextChapter=40`,
    );
    expect(reached.memberCount).toBe(2);
  });

  it("hides a member whose first appearance is on a later page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const early = await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearancePage: 12 },
      token: accessToken,
    });
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [early, late]);

    const gated = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextPage=50`,
    );
    expect(gated.memberCount).toBe(1);
    expect(gated.members.map((member) => member.characterName)).toEqual(["Duncan Idaho"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const reached = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextPage=420`,
    );
    expect(reached.memberCount).toBe(2);
  });

  it("hides a member whose first appearance is at a later audiobook position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const early = await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceAudioSeconds: 60 },
      token: accessToken,
    });
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [early, late]);

    const gated = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextAudioSeconds=600`,
    );
    expect(gated.memberCount).toBe(1);
    expect(gated.members.map((member) => member.characterName)).toEqual(["Duncan Idaho"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const reached = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextAudioSeconds=36000`,
    );
    expect(reached.memberCount).toBe(2);
  });

  it("keeps an earlier part's member visible while a position gates the context book", async () => {
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

    const gated = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(gated.memberCount).toBe(1);
    expect(gated.members.map((member) => member.characterName)).toEqual(["Paul Atreides"]);
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

    const gated = await groupDetails(
      accessToken,
      groupId,
      `?contextBookId=${firstBook}&contextChapter=99`,
    );
    expect(gated.memberCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const full = await groupDetails(accessToken, groupId);
    expect(full.memberCount).toBe(1);
    expect(full.members.map((member) => member.characterName)).toEqual(["Alia Atreides"]);
  });

  it("keeps a presence-hidden member out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const traitor = await addCharacter({
      bookId: secondBook,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [traitor]);

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const gated = await groupDetails(
        accessToken,
        groupId,
        `?contextBookId=${secondBook}${position}`,
      );
      expect(gated.memberCount).toBe(0);
      expect(JSON.stringify(gated)).not.toContain("The Traitor");
    }
  });

  it("keeps a profile-hidden member out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const heir = await addCharacter({
      bookId: secondBook,
      character: { hideProfileAsSpoiler: true },
      name: "Leto II",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [heir]);

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const gated = await groupDetails(
        accessToken,
        groupId,
        `?contextBookId=${secondBook}${position}`,
      );
      expect(gated.memberCount).toBe(0);
      expect(JSON.stringify(gated)).not.toContain("Leto II");
    }
  });

  it("rejects a reading position unless the context book is named", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook } = await createSeries(accessToken);
    const late = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    const groupId = await createGroupWithMembers(accessToken, [late]);

    const bare = await authed(
      "get",
      `/api/character-groups/${groupId}?contextChapter=5`,
      accessToken,
    );
    expect(bare.status).toBe(HttpStatus.BAD_REQUEST);
    expect(bare.body.errorsMessages).toEqual([
      {
        field: "contextBookId",
        message: "contextBookId is required when a reading position is supplied",
      },
    ]);
    expect(JSON.stringify(bare.body)).not.toContain("Alia Atreides");
  });

  it("leaves a request with no context book and no position untouched", async () => {
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
