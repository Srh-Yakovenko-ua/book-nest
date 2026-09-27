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
  hasHiddenRecords: boolean;
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
  readingPosition,
  seriesId,
  token,
}: {
  characterId: string;
  contextBookId: string;
  readingPosition: string;
  seriesId: string;
  token: string;
}): Promise<SurfaceReveal> {
  const query = `contextBookId=${contextBookId}${
    readingPosition === "" ? "" : `&${readingPosition}`
  }`;
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

describe("series roster reading-position gating", () => {
  it("hides a character whose first appearance is in a later chapter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const early = await addCharacter({
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

    const ungated = await seriesRoster(accessToken, seriesId, `?contextBookId=${secondBook}`);
    expect(ungated.totalCount).toBe(2);

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.characterId)).toEqual([early]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");

    const later = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=40`,
    );
    expect(later.totalCount).toBe(2);
  });

  it("hides a character whose first appearance is on a later page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearancePage: 12 },
      token: accessToken,
    });
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextPage=50`,
    );
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.name)).toEqual(["Duncan Idaho"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("hides a character whose first appearance is at a later audiobook position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      name: "Duncan Idaho",
      profile: { firstAppearanceAudioSeconds: 60 },
      token: accessToken,
    });
    await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextAudioSeconds=600`,
    );
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.name)).toEqual(["Duncan Idaho"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("keeps an earlier part's cast visible while a position gates the context book", async () => {
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

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(gated.totalCount).toBe(1);
    expect(gated.items.map((item) => item.name)).toEqual(["Paul Atreides"]);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("hides a future part's cast while reading an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { firstBook, secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({ bookId: secondBook, name: "Alia Atreides", token: accessToken });

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${firstBook}&contextChapter=99`,
    );
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("keeps a presence-hidden character out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const listed = await seriesRoster(
        accessToken,
        seriesId,
        `?contextBookId=${secondBook}${position}`,
      );
      expect(listed.totalCount).toBe(0);
      expect(JSON.stringify(listed)).not.toContain("The Traitor");
    }
  });

  it("keeps a profile-hidden character out of every reading position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    await addCharacter({
      bookId: secondBook,
      character: { hideProfileAsSpoiler: true },
      name: "Leto II",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    for (const position of ["", "&contextChapter=1", "&contextChapter=99"]) {
      const listed = await seriesRoster(
        accessToken,
        seriesId,
        `?contextBookId=${secondBook}${position}`,
      );
      expect(listed.totalCount).toBe(0);
      expect(JSON.stringify(listed)).not.toContain("Leto II");
    }
  });

  it("cannot surface an unreached character through a spoiler-safe alias", async () => {
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

    const ungated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&q=saint`,
    );
    expect(ungated.totalCount).toBe(1);

    const gated = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&q=saint&contextChapter=5`,
    );
    expect(gated.totalCount).toBe(0);
    expect(JSON.stringify(gated)).not.toContain("Alia");
  });

  it("keeps the page total and the listed page in agreement under a reading position", async () => {
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
      `?contextBookId=${secondBook}&contextChapter=3&pageSize=1`,
    );
    expect(firstPage.totalCount).toBe(2);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha"]);

    const secondPage = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=3&pageSize=1&pageNumber=2`,
    );
    expect(secondPage.totalCount).toBe(2);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Beta"]);
    expect(JSON.stringify(secondPage)).not.toContain("Gamma");
  });
});

describe("series character summary reading-position gating", () => {
  it("counts only the characters the reader has reached", async () => {
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

    const ungated = await seriesSummary(accessToken, seriesId, `?contextBookId=${secondBook}`);
    expect(ungated.totalVisibleCharacters).toBe(2);
    expect(ungated.hasHiddenRecords).toBe(false);

    const gated = await seriesSummary(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(gated.totalVisibleCharacters).toBe(1);
    expect(gated.top.map((entry) => entry.name)).toEqual(["Duncan Idaho"]);
    expect(gated.hasHiddenRecords).toBe(true);
    expect(JSON.stringify(gated)).not.toContain("Alia Atreides");
  });

  it("matches the series roster total at the same reading position", async () => {
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

    for (const chapter of [1, 9, 30, 99]) {
      const query = `?contextBookId=${secondBook}&contextChapter=${chapter}`;
      const listed = await seriesRoster(accessToken, seriesId, query);
      const recap = await seriesSummary(accessToken, seriesId, query);
      expect(recap.totalVisibleCharacters).toBe(listed.totalCount);
    }
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

    const recap = await seriesSummary(
      accessToken,
      seriesId,
      `?contextBookId=${firstBook}&contextChapter=99`,
    );
    expect(recap.totalVisibleCharacters).toBe(0);
    expect(recap.top).toEqual([]);
    expect(JSON.stringify(recap)).not.toContain("Alia Atreides");
  });
});

describe("series character profile reading-position gating", () => {
  it("hides the profile of a character the reader has not reached yet", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const gated = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}&contextChapter=5`,
      accessToken,
    );
    expect(gated.status).toBe(HttpStatus.NOT_FOUND);
    expect(gated.body.code).toBe("character_not_found");
    expect(JSON.stringify(gated.body)).not.toContain("Alia Atreides");

    const reached = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}&contextChapter=40`,
      accessToken,
    );
    expect(reached.status).toBe(HttpStatus.OK);
    expect(reached.body.name).toBe("Alia Atreides");
  });

  it("drops an unreached appearance from the timeline of a character seen in an earlier part", async () => {
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

    const gated = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}&contextChapter=5`,
      accessToken,
    );
    expect(gated.status).toBe(HttpStatus.OK);
    expect(gated.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      firstBook,
    ]);
    expect(JSON.stringify(gated.body)).not.toContain("dead");

    const reached = await authed(
      "get",
      `/api/series/${seriesId}/characters/${characterId}?contextBookId=${secondBook}&contextChapter=40`,
      accessToken,
    );
    expect(reached.body.appearances.map((entry: { bookId: string }) => entry.bookId)).toEqual([
      firstBook,
      secondBook,
    ]);
  });
});

describe("contextual character surfaces agree across book and series", () => {
  it("reveals a character on every contextual surface or on none of them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      readingPosition: "contextChapter=5",
      seriesId,
      token: accessToken,
    });
    expect(unreached).toEqual({
      bookRoster: false,
      details: false,
      seriesProfile: false,
      seriesRoster: false,
      seriesSummaryTop: false,
    });

    const gatedRoster = await seriesRoster(
      accessToken,
      seriesId,
      `?contextBookId=${secondBook}&contextChapter=5`,
    );
    expect(JSON.stringify(gatedRoster)).not.toContain("Alia Atreides");

    const reached = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      readingPosition: "contextChapter=40",
      seriesId,
      token: accessToken,
    });
    expect(reached).toEqual({
      bookRoster: true,
      details: true,
      seriesProfile: true,
      seriesRoster: true,
      seriesSummaryTop: true,
    });
  });

  it("agrees that an unreached audiobook position hides every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      readingPosition: "contextAudioSeconds=600",
      seriesId,
      token: accessToken,
    });
    expect(unreached).toEqual({
      bookRoster: false,
      details: false,
      seriesProfile: false,
      seriesRoster: false,
      seriesSummaryTop: false,
    });

    const reached = await revealAcrossSurfaces({
      characterId,
      contextBookId: secondBook,
      readingPosition: "contextAudioSeconds=36000",
      seriesId,
      token: accessToken,
    });
    expect(reached).toEqual({
      bookRoster: true,
      details: true,
      seriesProfile: true,
      seriesRoster: true,
      seriesSummaryTop: true,
    });
  });

  it("agrees that a presence-hidden character is never revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });

    for (const readingPosition of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        characterId,
        contextBookId: secondBook,
        readingPosition,
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
    }
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
      readingPosition: "contextChapter=99",
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

  it("rejects a reading position on every series surface unless the context book is named", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { secondBook, seriesId } = await createSeries(accessToken);
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    for (const path of [
      `/api/series/${seriesId}/characters?contextChapter=5`,
      `/api/series/${seriesId}/character-summary?contextChapter=5`,
      `/api/series/${seriesId}/characters/${characterId}?contextChapter=5`,
    ]) {
      const bare = await authed("get", path, accessToken);
      expect(bare.status).toBe(HttpStatus.BAD_REQUEST);
      expect(bare.body.errorsMessages).toEqual([
        {
          field: "contextBookId",
          message: "contextBookId is required when a reading position is supplied",
        },
      ]);
      expect(JSON.stringify(bare.body)).not.toContain("Alia Atreides");
    }
  });

  it("leaves a request with no reading position untouched", async () => {
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
    expect(recap.hasHiddenRecords).toBe(false);
  });
});
