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

type RosterBody = { items: { characterId: string; name: string }[]; totalCount: number };

type SummaryBody = {
  hasHiddenRecords: boolean;
  top: { characterId: string; name: string }[];
  totalVisibleCharacters: number;
};

type SurfaceReveal = {
  details: boolean;
  roster: boolean;
  search: boolean;
  summaryTop: boolean;
};

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

async function addSeriesBook(
  token: string,
  seriesId: string,
  partNumber: number,
  title: string,
): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber,
    seriesId,
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function authed(method: "get" | "patch" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, title = "Dune"): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createSeriesFirstBook(
  token: string,
  seriesName: string,
): Promise<{ bookId: string; seriesId: string }> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    newSeries: { name: seriesName },
    ownershipStatus: "owned",
    partNumber: 1,
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return { bookId: res.body.id, seriesId: res.body.series.id };
}

async function detailsStatus({
  characterId,
  context: readingContext,
  token,
}: {
  characterId: string;
  context: string;
  token: string;
}): Promise<number> {
  const res = await authed("get", `/api/characters/${characterId}?${readingContext}`, token);
  return res.status;
}

async function replaceGlobalAliases({
  aliases,
  characterId,
  token,
}: {
  aliases: Record<string, unknown>[];
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("patch", `/api/characters/${characterId}`, token).send({ aliases });
  expect(res.status).toBe(HttpStatus.OK);
}

async function revealAcrossSurfaces({
  bookId,
  characterId,
  name,
  readingContext,
  token,
}: {
  bookId: string;
  characterId: string;
  name: string;
  readingContext: string;
  token: string;
}): Promise<SurfaceReveal> {
  const query = readingContext === "" ? "" : `?${readingContext}`;
  const listed = await roster(token, bookId, query);
  const found = await roster(
    token,
    bookId,
    `?search=${encodeURIComponent(name)}${readingContext === "" ? "" : `&${readingContext}`}`,
  );
  const recap = await summary(token, bookId, query);
  const status = await detailsStatus({
    characterId,
    context: `contextBookId=${bookId}${readingContext === "" ? "" : `&${readingContext}`}`,
    token,
  });

  return {
    details: status === HttpStatus.OK,
    roster: listed.items.some((item) => item.characterId === characterId),
    search: found.items.some((item) => item.characterId === characterId),
    summaryTop: recap.top.some((entry) => entry.characterId === characterId),
  };
}

async function roster(token: string, bookId: string, query = ""): Promise<RosterBody> {
  const res = await authed("get", `/api/books/${bookId}/characters${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

async function summary(token: string, bookId: string, query = ""): Promise<SummaryBody> {
  const res = await authed("get", `/api/books/${bookId}/character-summary${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("book roster reading-position gating", () => {
  it("hides a character whose first appearance is in a later chapter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const early = await addCharacter({
      bookId,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    const late = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const ungated = await roster(accessToken, bookId);
    expect(ungated.totalCount).toBe(2);

    const gated = await roster(accessToken, bookId, "?contextChapter=5");
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.characterId)).toEqual([early]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const later = await roster(accessToken, bookId, "?contextChapter=40&sort=name");
    expect(later.items.map((item) => item.characterId)).toEqual([late, early]);
  });

  it("hides a character whose first appearance is on a later page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addCharacter({
      bookId,
      name: "Duncan Idaho",
      profile: { firstAppearancePage: 12 },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });

    const gated = await roster(accessToken, bookId, "?contextPage=50");
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.name)).toEqual(["Duncan Idaho"]);
  });

  it("hides a character whose first appearance is at a later audiobook position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addCharacter({
      bookId,
      name: "Duncan Idaho",
      profile: { firstAppearanceAudioSeconds: 60 },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const gated = await roster(accessToken, bookId, "?contextAudioSeconds=600");
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.name)).toEqual(["Duncan Idaho"]);
  });

  it("keeps the page total and the listed page in agreement under a reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    for (const seed of [
      { chapter: "1", name: "Alpha" },
      { chapter: "2", name: "Beta" },
      { chapter: "30", name: "Gamma" },
      { chapter: "31", name: "Delta" },
    ]) {
      await addCharacter({
        bookId,
        name: seed.name,
        profile: { firstAppearanceChapter: seed.chapter },
        token: accessToken,
      });
    }

    const firstPage = await roster(accessToken, bookId, "?contextChapter=3&sort=name&pageSize=1");
    expect(firstPage.totalCount).toBe(2);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha"]);

    const secondPage = await roster(
      accessToken,
      bookId,
      "?contextChapter=3&sort=name&pageSize=1&pageNumber=2",
    );
    expect(secondPage.totalCount).toBe(2);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Beta"]);
  });

  it("keeps a presence-hidden character out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addCharacter({
      bookId,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });

    const ungated = await roster(accessToken, bookId);
    expect(ungated.totalCount).toBe(0);

    const gated = await roster(accessToken, bookId, "?contextChapter=99");
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("The Traitor");
  });

  it("returns 404 for a context book the user does not own", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed(
      "get",
      `/api/books/${bookId}/characters?contextBookId=99999999-9999-4999-8999-999999999999`,
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
    expect(res.body.code).toBe("character_book_not_found");
  });
});

describe("book roster series-position gating", () => {
  it("shows an earlier book's roster while reading a later part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await addCharacter({ bookId: firstBook, name: "Paul Atreides", token: accessToken });

    const listed = await roster(accessToken, firstBook, `?contextBookId=${secondBook}`);
    expect(listed.totalCount).toBe(1);
    expect(listed.items[0]?.name).toBe("Paul Atreides");
  });

  it("empties a future book's roster and summary while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await addCharacter({ bookId: secondBook, name: "Alia Atreides", token: accessToken });

    const listed = await roster(accessToken, secondBook, `?contextBookId=${firstBook}`);
    expect(listed.totalCount).toBe(0);
    expect(JSON.stringify(listed)).not.toContain("Alia Atreides");

    const recap = await summary(accessToken, secondBook, `?contextBookId=${firstBook}`);
    expect(recap.totalVisibleCharacters).toBe(0);
    expect(recap.top).toEqual([]);
    expect(recap.hasHiddenRecords).toBe(true);
    expect(JSON.stringify(recap)).not.toContain("Alia Atreides");
  });
});

describe("book roster contextual search", () => {
  it("cannot surface an unreached character through a spoiler-safe alias", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await replaceGlobalAliases({
      aliases: [{ isSpoiler: false, name: "Saint Alia of the Knife", type: "title" }],
      characterId,
      token: accessToken,
    });

    const ungated = await roster(accessToken, bookId, "?search=saint");
    expect(ungated.totalCount).toBe(1);

    const gated = await roster(accessToken, bookId, "?search=saint&contextChapter=5");
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia");
  });

  it("cannot surface a future book's character through the current book's search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    await addCharacter({ bookId: secondBook, name: "Alia Atreides", token: accessToken });

    const gated = await roster(accessToken, secondBook, `?search=alia&contextBookId=${firstBook}`);
    expect(gated.totalCount).toBe(0);
  });
});

describe("book roster summary reading-position gating", () => {
  it("counts only the characters the reader has reached", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addCharacter({
      bookId,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2", importance: "central", isPovCharacter: true },
      token: accessToken,
    });
    await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40", importance: "central" },
      token: accessToken,
    });

    const ungated = await summary(accessToken, bookId);
    expect(ungated.totalVisibleCharacters).toBe(2);
    expect(ungated.hasHiddenRecords).toBe(false);

    const gated = await summary(accessToken, bookId, "?contextChapter=5");
    expect(gated.totalVisibleCharacters).toBe(1);
    expect(gated.top.map((entry) => entry.name)).toEqual(["Duncan Idaho"]);
    expect(gated.hasHiddenRecords).toBe(true);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("matches the roster total at the same reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    for (const seed of [
      { chapter: "1", name: "Alpha" },
      { chapter: "9", name: "Beta" },
      { chapter: "30", name: "Gamma" },
    ]) {
      await addCharacter({
        bookId,
        name: seed.name,
        profile: { firstAppearanceChapter: seed.chapter },
        token: accessToken,
      });
    }

    for (const chapter of [1, 9, 30, 99]) {
      const listed = await roster(accessToken, bookId, `?contextChapter=${chapter}`);
      const recap = await summary(accessToken, bookId, `?contextChapter=${chapter}`);
      expect(recap.totalVisibleCharacters).toBe(listed.totalCount);
    }
  });
});

describe("contextual character surfaces agree", () => {
  it("reveals a character on all four surfaces or on none of them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40", importance: "central" },
      token: accessToken,
    });

    const beforeFirstAppearance = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      readingContext: "contextChapter=5",
      token: accessToken,
    });
    expect(beforeFirstAppearance).toEqual({
      details: false,
      roster: false,
      search: false,
      summaryTop: false,
    });

    const afterFirstAppearance = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      readingContext: "contextChapter=40",
      token: accessToken,
    });
    expect(afterFirstAppearance).toEqual({
      details: true,
      roster: true,
      search: true,
      summaryTop: true,
    });
  });

  it("rejects a reading position on the details surface unless the context book is named", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40", importance: "central" },
      token: accessToken,
    });

    const bare = await authed(
      "get",
      `/api/characters/${characterId}?contextChapter=5`,
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

    const named = await detailsStatus({
      characterId,
      context: `contextBookId=${bookId}&contextChapter=5`,
      token: accessToken,
    });
    expect(named).toBe(HttpStatus.NOT_FOUND);

    const gated = await roster(accessToken, bookId, "?contextChapter=5");
    expect(gated.totalCount).toBe(0);
  });

  it("agrees that a presence-hidden character is never revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true, importance: "central" },
      token: accessToken,
    });

    for (const readingContext of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        bookId,
        characterId,
        name: "Traitor",
        readingContext,
        token: accessToken,
      });
      expect(reveal).toEqual({ details: false, roster: false, search: false, summaryTop: false });
    }
  });

  it("agrees that an unreached audiobook position hides every surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000, importance: "central" },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      readingContext: "contextAudioSeconds=600",
      token: accessToken,
    });
    expect(unreached).toEqual({
      details: false,
      roster: false,
      search: false,
      summaryTop: false,
    });

    const reached = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      readingContext: "contextAudioSeconds=36000",
      token: accessToken,
    });
    expect(reached).toEqual({ details: true, roster: true, search: true, summaryTop: true });
  });
});
