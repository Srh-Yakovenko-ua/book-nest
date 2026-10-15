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

type SeriesSetup = { firstBook: string; secondBook: string; seriesId: string };

type SummaryBody = {
  top: { characterId: string; name: string }[];
  totalVisibleCharacters: number;
};

type SurfaceReveal = {
  bookRoster: boolean;
  details: boolean;
  seriesProfile: boolean;
  seriesRoster: boolean;
  seriesSummaryTop: boolean;
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

async function bookRoster(token: string, bookId: string, query = ""): Promise<RosterBody> {
  const res = await authed("get", `/api/books/${bookId}/characters${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
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
  const secondBook = await addSeriesBook(token, seriesId, 2, "Dune Messiah");
  return { firstBook: res.body.id, secondBook, seriesId };
}

async function detailsStatus({
  characterId,
  query,
  token,
}: {
  characterId: string;
  query: string;
  token: string;
}): Promise<number> {
  const res = await authed("get", `/api/characters/${characterId}?${query}`, token);
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
  characterId,
  contextBookId,
  seriesId,
  token,
}: {
  characterId: string;
  contextBookId: string;
  seriesId: string;
  token: string;
}): Promise<SurfaceReveal> {
  const query = `contextBookId=${contextBookId}`;
  const [listedInBook, listedInSeries, recap, profile, details] = await Promise.all([
    bookRoster(token, contextBookId, `?${query}`),
    seriesRoster(token, seriesId, `?${query}`),
    seriesSummary(token, seriesId, `?${query}`),
    seriesProfileStatus({ characterId, query, seriesId, token }),
    detailsStatus({ characterId, query, token }),
  ]);

  return {
    bookRoster: listedInBook.items.some((item) => item.characterId === characterId),
    details: details === HttpStatus.OK,
    seriesProfile: profile === HttpStatus.OK,
    seriesRoster: listedInSeries.items.some((item) => item.characterId === characterId),
    seriesSummaryTop: recap.top.some((entry) => entry.characterId === characterId),
  };
}

async function seriesProfileStatus({
  characterId,
  query,
  seriesId,
  token,
}: {
  characterId: string;
  query: string;
  seriesId: string;
  token: string;
}): Promise<number> {
  const res = await authed(
    "get",
    `/api/series/${seriesId}/characters/${characterId}?${query}`,
    token,
  );
  return res.status;
}

async function seriesRoster(token: string, seriesId: string, query = ""): Promise<RosterBody> {
  const res = await authed("get", `/api/series/${seriesId}/characters${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

async function seriesSummary(token: string, seriesId: string, query = ""): Promise<SummaryBody> {
  const res = await authed("get", `/api/series/${seriesId}/character-summary${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

describe("series roster in a reading context", () => {
  it("lists characters whatever their first-appearance chapter, page or audio position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    for (const seed of [
      { name: "Duncan Idaho", profile: { firstAppearanceChapter: "2" } },
      { name: "Alia Atreides", profile: { firstAppearanceChapter: "40" } },
      { name: "Hayt", profile: { firstAppearancePage: 420 } },
      { name: "Scytale", profile: { firstAppearanceAudioSeconds: 36000 } },
    ]) {
      await addCharacter({
        bookId: secondBook,
        name: seed.name,
        profile: seed.profile,
        token: accessToken,
      });
    }

    const listed = await seriesRoster(accessToken, seriesId, `?contextBookId=${secondBook}`);

    expect(listed.totalCount).toBe(4);
    expect(listed.items.map((item) => item.name)).toEqual([
      "Alia Atreides",
      "Duncan Idaho",
      "Hayt",
      "Scytale",
    ]);
  });

  it("keeps an earlier part's cast visible next to the context book's cast", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
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

    const listed = await seriesRoster(accessToken, seriesId, `?contextBookId=${secondBook}`);

    expect(listed.items.map((item) => item.name)).toEqual(["Alia Atreides", "Paul Atreides"]);
  });

  it("hides a future part's cast while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({ bookId: secondBook, name: "Alia Atreides", token: accessToken });

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${firstBook}&includeFuture=false`,
    );

    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("lists a future part's cast from an earlier part when includeFuture is set", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({ bookId: secondBook, name: "Alia Atreides", token: accessToken });

    const listed = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${firstBook}&includeFuture=true`,
    );

    expect(listed.items.map((item) => item.name)).toEqual(["Alia Atreides"]);
  });

  it("finds a late-appearing character through a spoiler-safe alias", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    await replaceGlobalAliases({
      aliases: [{ isSpoiler: false, name: "Saint Alia of the Knife", type: "title" }],
      characterId,
      token: accessToken,
    });

    const found = await seriesRoster(accessToken, seriesId, `?contextBookId=${secondBook}&q=saint`);

    expect(found.items.map((item) => item.characterId)).toEqual([characterId]);
  });

  it("keeps the page total and the listed page in agreement", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    for (const seed of [
      { chapter: "1", name: "Alpha" },
      { chapter: "2", name: "Beta" },
      { chapter: "30", name: "Gamma" },
      { chapter: "31", name: "Delta" },
    ]) {
      await addCharacter({
        bookId: secondBook,
        name: seed.name,
        profile: { firstAppearanceChapter: seed.chapter },
        token: accessToken,
      });
    }

    const firstPage = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&pageSize=1`,
    );
    expect(firstPage.totalCount).toBe(4);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha"]);

    const secondPage = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&pageSize=1&pageNumber=2`,
    );
    expect(secondPage.totalCount).toBe(4);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Beta"]);
  });
});

describe("series character summary in a reading context", () => {
  it("counts every character whatever its first-appearance position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceChapter: "2" },
      token: accessToken,
    });
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const recap = await seriesSummary(accessToken, seriesId, `?contextBookId=${secondBook}`);

    expect(recap.totalVisibleCharacters).toBe(2);
    expect(recap.top.map((entry) => entry.name).sort()).toEqual(["Alia Atreides", "Duncan Idaho"]);
  });

  it("matches the series roster total in the same reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    for (const seed of [
      { chapter: "1", name: "Alpha" },
      { chapter: "9", name: "Beta" },
      { chapter: "30", name: "Gamma" },
    ]) {
      await addCharacter({
        bookId: secondBook,
        name: seed.name,
        profile: { firstAppearanceChapter: seed.chapter },
        token: accessToken,
      });
    }

    const totals: { listed: number; summarised: number }[] = [];
    for (const contextBookId of [firstBook, secondBook]) {
      const query = `?contextBookId=${contextBookId}`;
      const listed = await seriesRoster(accessToken, seriesId, query);
      const recap = await seriesSummary(accessToken, seriesId, query);
      totals.push({ listed: listed.totalCount, summarised: recap.totalVisibleCharacters });
    }

    expect(totals).toEqual([
      { listed: 1, summarised: 1 },
      { listed: 4, summarised: 4 },
    ]);
  });

  it("hides a future part's cast from the summary while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    const recap = await seriesSummary(accessToken, seriesId, `?contextBookId=${firstBook}`);

    expect(recap.totalVisibleCharacters).toBe(0);
    expect(recap.top).toEqual([]);
    expect(JSON.stringify(recap)).not.toContain("Alia Atreides");
  });
});

describe("series character profile in a reading context", () => {
  it("returns the profile of a character first met late in the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.name).toBe("Alia Atreides");
  });

  it("keeps the context book's late appearance on the timeline of a character seen in an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const linked = await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: { firstAppearanceChapter: "40", importance: "central", status: "dead" },
      characterId,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      firstBook,
      secondBook,
    ]);
  });

  it("drops a later part's appearance from the timeline while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const linked = await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: { importance: "central", status: "dead" },
      characterId,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);

    const res = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${firstBook}&includeFuture=false`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      firstBook,
    ]);
    expect(JSON.stringify(res.body)).not.toContain("dead");
  });
});

describe("contextual character surfaces agree across book and series", () => {
  it("reveals a late-chapter character on every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      seriesId,
      token: accessToken,
    });

    expect(reveal).toEqual({
      bookRoster: true,
      details: true,
      seriesProfile: true,
      seriesRoster: true,
      seriesSummaryTop: true,
    });
  });

  it("reveals a character first heard late in the audiobook on every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      seriesId,
      token: accessToken,
    });

    expect(reveal).toEqual({
      bookRoster: true,
      details: true,
      seriesProfile: true,
      seriesRoster: true,
      seriesSummaryTop: true,
    });
  });

  it("agrees that a future part's character is never revealed from an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      characterId,
      contextBookId: firstBook,
      seriesId,
      token: accessToken,
    });

    expect(reveal).toEqual({
      bookRoster: false,
      details: false,
      seriesProfile: false,
      seriesRoster: false,
      seriesSummaryTop: false,
    });
  });

  it("lists every part's cast without a reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const listed = await seriesRoster(accessToken, seriesId);
    expect(listed.totalCount).toBe(2);

    const recap = await seriesSummary(accessToken, seriesId);
    expect(recap.totalVisibleCharacters).toBe(2);
  });
});
