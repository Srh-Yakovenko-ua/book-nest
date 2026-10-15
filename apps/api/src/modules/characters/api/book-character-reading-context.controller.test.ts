import type { CharacterRevealFieldKey, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CharacterRevealFieldKeySchema } from "@app/shared";
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
import { CharactersModule } from "../characters.module.js";

type AliasView = { bookId: Nullable<string>; isSpoiler: boolean; name: string };

type RosterBody = {
  items: { characterId: string; hiddenFields: string[]; name: string }[];
  totalCount: number;
};

type SpoiledCharacter = { characterId: string; portraitMediaId: string; speciesId: string };

type SuggestionSurfaceReveal = {
  control: boolean;
  roster: boolean;
  suggestions: boolean;
};

type SummaryBody = {
  top: { characterId: string; hiddenFields: string[]; name: string }[];
  totalVisibleCharacters: number;
};

type SurfaceReveal = {
  details: boolean;
  roster: boolean;
  search: boolean;
  summaryTop: boolean;
};

const SPOILER_TEXT = {
  appearanceNotes: "Eyes turned blue-within-blue",
  bookAlias: "Lisan al-Gaib",
  description: "Becomes the Kwisatz Haderach",
  displayName: "Muad'Dib",
  globalAlias: "Mahdi of the Fremen",
  personalImpression: "Turns into a tyrant",
  speciesName: "Spice-touched",
  statusCustomText: "Walks the Golden Path",
};

const PLAIN_ALIAS = { book: "Young Master", global: "Usul" };

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

function aliasNamesOf(res: request.Response): string[] {
  return res.body.aliases.map((alias: AliasView) => alias.name).sort();
}

function authed(method: "get" | "patch" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function contextualDetails({
  characterId,
  contextBookId,
  reveal = [],
  token,
}: {
  characterId: string;
  contextBookId: string;
  reveal?: readonly CharacterRevealFieldKey[];
  token: string;
}): Promise<request.Response> {
  const reveals = reveal.map((fieldId) => `&revealFieldIds=${fieldId}`).join("");
  const res = await authed(
    "get",
    `/api/characters/${characterId}?contextBookId=${contextBookId}${reveals}`,
    token,
  );
  expect(res.status).toBe(HttpStatus.OK);
  return res;
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

async function createOwnSpecies(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/species", token).send({ name });
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

async function createSpoiledCharacter({
  bookId,
  token,
  userId,
}: {
  bookId: string;
  token: string;
  userId: string;
}): Promise<SpoiledCharacter> {
  const portraitMediaId = await insertPortraitMedia(userId);
  const speciesId = await createOwnSpecies(token, SPOILER_TEXT.speciesName);
  const characterId = await addCharacter({
    bookId,
    name: "Paul Atreides",
    profile: {
      appearanceNotes: SPOILER_TEXT.appearanceNotes,
      appearanceNotesIsSpoiler: true,
      description: SPOILER_TEXT.description,
      descriptionIsSpoiler: true,
      displayName: SPOILER_TEXT.displayName,
      displayNameIsSpoiler: true,
      personalImpression: SPOILER_TEXT.personalImpression,
      personalImpressionIsSpoiler: true,
      portraitIsSpoiler: true,
      portraitMediaId,
      roles: [{ roleType: "supporting" }, { isSpoiler: true, roleType: "antagonist" }],
      speciesOverrideId: speciesId,
      speciesOverrideIsSpoiler: true,
      status: "other",
      statusCustomText: SPOILER_TEXT.statusCustomText,
      statusIsSpoiler: true,
    },
    token,
  });
  await replaceGlobalAliases({
    aliases: [
      { name: PLAIN_ALIAS.global, type: "nickname" },
      { isSpoiler: true, name: SPOILER_TEXT.globalAlias, type: "title" },
    ],
    characterId,
    token,
  });
  await replaceBookAliases({
    aliases: [
      { name: PLAIN_ALIAS.book, type: "nickname" },
      { isSpoiler: true, name: SPOILER_TEXT.bookAlias, type: "title" },
    ],
    bookId,
    characterId,
    token,
  });
  return { characterId, portraitMediaId, speciesId };
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

async function insertPortraitMedia(userId: string): Promise<string> {
  const asset = await app.get(PrismaService).mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 100,
      kind: "avatar",
      sizeBytes: 1234,
      storageKey: `media/avatar/${randomUUID()}/image.webp`,
      userId,
      width: 100,
    },
  });
  return asset.id;
}

async function replaceBookAliases({
  aliases,
  bookId,
  characterId,
  token,
}: {
  aliases: Record<string, unknown>[];
  bookId: string;
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("patch", `/api/books/${bookId}/characters/${characterId}`, token).send({
    aliases,
  });
  expect(res.status).toBe(HttpStatus.OK);
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
  token,
}: {
  bookId: string;
  characterId: string;
  name: string;
  token: string;
}): Promise<SurfaceReveal> {
  const readingContext = `contextBookId=${bookId}`;
  const listed = await roster(token, bookId, `?${readingContext}`);
  const found = await roster(
    token,
    bookId,
    `?search=${encodeURIComponent(name)}&${readingContext}`,
  );
  const recap = await summary(token, bookId, `?${readingContext}`);
  const status = await detailsStatus({ characterId, context: readingContext, token });

  return {
    details: status === HttpStatus.OK,
    roster: listed.items.some((item) => item.characterId === characterId),
    search: found.items.some((item) => item.characterId === characterId),
    summaryTop: recap.top.some((entry) => entry.characterId === characterId),
  };
}

async function revealOnRosterAndSuggestions({
  characterId,
  controlCharacterId,
  homeBookId,
  readingContext,
  suggestionsBookId,
  token,
}: {
  characterId: string;
  controlCharacterId: string;
  homeBookId: string;
  readingContext: string;
  suggestionsBookId: string;
  token: string;
}): Promise<SuggestionSurfaceReveal> {
  const listed = await roster(token, homeBookId, `?${readingContext}`);
  const suggested = await authed(
    "get",
    `/api/books/${suggestionsBookId}/character-suggestions?${readingContext}`,
    token,
  );
  expect(suggested.status).toBe(HttpStatus.OK);
  const suggestedIds = suggested.body.suggestions.map((row: { id: string }) => row.id);

  return {
    control: suggestedIds.includes(controlCharacterId),
    roster: listed.items.some((item) => item.characterId === characterId),
    suggestions: suggestedIds.includes(characterId),
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

describe("book roster in a reading context", () => {
  it("lists characters whatever their first-appearance chapter, page or audio position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    for (const seed of [
      { name: "Duncan Idaho", profile: { firstAppearanceChapter: "2" } },
      { name: "Alia Atreides", profile: { firstAppearanceChapter: "40" } },
      { name: "Feyd-Rautha", profile: { firstAppearancePage: 420 } },
      { name: "Shaddam IV", profile: { firstAppearanceAudioSeconds: 36000 } },
    ]) {
      await addCharacter({ bookId, name: seed.name, profile: seed.profile, token: accessToken });
    }

    const listed = await roster(accessToken, bookId, `?contextBookId=${bookId}&sort=name`);

    expect(listed.totalCount).toBe(4);
    expect(listed.items.map((item) => item.name)).toEqual([
      "Alia Atreides",
      "Duncan Idaho",
      "Feyd-Rautha",
      "Shaddam IV",
    ]);
  });

  it("keeps the page total and the listed page in agreement", async () => {
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

    const firstPage = await roster(
      accessToken,
      bookId,
      `?contextBookId=${bookId}&sort=name&pageSize=1`,
    );
    expect(firstPage.totalCount).toBe(4);
    expect(firstPage.items.map((item) => item.name)).toEqual(["Alpha"]);

    const secondPage = await roster(
      accessToken,
      bookId,
      `?contextBookId=${bookId}&sort=name&pageSize=1&pageNumber=2`,
    );
    expect(secondPage.totalCount).toBe(4);
    expect(secondPage.items.map((item) => item.name)).toEqual(["Beta"]);
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
    expect(JSON.stringify(recap)).not.toContain("Alia Atreides");
  });
});

describe("book roster contextual search", () => {
  it("finds a late-appearing character through a spoiler-safe alias", async () => {
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

    const found = await roster(accessToken, bookId, `?search=saint&contextBookId=${bookId}`);

    expect(found.items.map((item) => item.characterId)).toEqual([characterId]);
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

describe("book roster summary in a reading context", () => {
  it("counts every character whatever its first-appearance position", async () => {
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

    const recap = await summary(accessToken, bookId, `?contextBookId=${bookId}`);

    expect(recap.totalVisibleCharacters).toBe(2);
    expect(recap.top.map((entry) => entry.name).sort()).toEqual(["Alia Atreides", "Duncan Idaho"]);
  });

  it("matches the roster total in the same reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
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
    for (const query of ["", `?contextBookId=${firstBook}`, `?contextBookId=${secondBook}`]) {
      const listed = await roster(accessToken, secondBook, query);
      const recap = await summary(accessToken, secondBook, query);
      totals.push({ listed: listed.totalCount, summarised: recap.totalVisibleCharacters });
    }

    expect(totals).toEqual([
      { listed: 3, summarised: 3 },
      { listed: 0, summarised: 0 },
      { listed: 3, summarised: 3 },
    ]);
  });
});

describe("contextual character surfaces agree", () => {
  it("reveals a late-chapter character on all four surfaces", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40", importance: "central" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      token: accessToken,
    });

    expect(reveal).toEqual({ details: true, roster: true, search: true, summaryTop: true });
  });

  it("reveals a character first heard late in the audiobook on all four surfaces", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000, importance: "central" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      bookId,
      characterId,
      name: "Alia",
      token: accessToken,
    });

    expect(reveal).toEqual({ details: true, roster: true, search: true, summaryTop: true });
  });

  it("suggests a character for a sibling part exactly when the roster reveals it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const standaloneBook = await createBook(accessToken, "Foundation");
    const characterId = await addCharacter({
      bookId: secondBook,
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });
    const controlCharacterId = await addCharacter({
      bookId: standaloneBook,
      name: "Hari Seldon",
      token: accessToken,
    });

    const fromEarlierPart = await revealOnRosterAndSuggestions({
      characterId,
      controlCharacterId,
      homeBookId: secondBook,
      readingContext: `contextBookId=${firstBook}`,
      suggestionsBookId: firstBook,
      token: accessToken,
    });
    expect(fromEarlierPart).toEqual({ control: true, roster: false, suggestions: false });

    const fromItsOwnPart = await revealOnRosterAndSuggestions({
      characterId,
      controlCharacterId,
      homeBookId: secondBook,
      readingContext: `contextBookId=${secondBook}`,
      suggestionsBookId: firstBook,
      token: accessToken,
    });
    expect(fromItsOwnPart).toEqual({ control: true, roster: true, suggestions: true });
  });
});

describe("contextual character details spoiler masking", () => {
  it("nulls all seven spoiler book values and lists them with roles and both alias groups before any reveal", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const { characterId } = await createSpoiledCharacter({ bookId, token: accessToken, userId });

    const res = await contextualDetails({ characterId, contextBookId: bookId, token: accessToken });

    const appearance = res.body.appearances[0];
    expect(appearance).toMatchObject({
      appearanceNotes: null,
      description: null,
      displayName: null,
      personalImpression: null,
      portrait: null,
      speciesOverride: null,
      status: null,
      statusCustomText: null,
    });
    expect(appearance.roles.map((role: { roleType: string }) => role.roleType)).toEqual([
      "supporting",
    ]);
    expect(appearance.hiddenFields).toEqual([
      "appearanceNotes",
      "description",
      "displayName",
      "personalImpression",
      "portrait",
      "roles",
      "speciesOverride",
      "status",
    ]);
    expect(res.body.hiddenFields).toEqual([
      "appearanceNotes",
      "bookAliases",
      "description",
      "displayName",
      "globalAliases",
      "personalImpression",
      "portrait",
      "roles",
      "speciesOverride",
      "status",
    ]);
    expect(aliasNamesOf(res)).toEqual([PLAIN_ALIAS.global, PLAIN_ALIAS.book].sort());
  });

  it("leaks no withheld value, alias name, role, portrait or species id into the response before reveal", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const { characterId, portraitMediaId, speciesId } = await createSpoiledCharacter({
      bookId,
      token: accessToken,
      userId,
    });

    const res = await contextualDetails({ characterId, contextBookId: bookId, token: accessToken });

    const body = JSON.stringify(res.body);
    const withheld = [...Object.values(SPOILER_TEXT), portraitMediaId, speciesId, "antagonist"];
    expect(withheld.filter((secret) => body.includes(secret))).toEqual([]);
  });

  it("returns every book value, role and alias once every reveal key is sent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const { characterId, portraitMediaId, speciesId } = await createSpoiledCharacter({
      bookId,
      token: accessToken,
      userId,
    });

    const res = await contextualDetails({
      characterId,
      contextBookId: bookId,
      reveal: CharacterRevealFieldKeySchema.options,
      token: accessToken,
    });

    const appearance = res.body.appearances[0];
    expect(appearance).toMatchObject({
      appearanceNotes: SPOILER_TEXT.appearanceNotes,
      description: SPOILER_TEXT.description,
      displayName: SPOILER_TEXT.displayName,
      hiddenFields: [],
      personalImpression: SPOILER_TEXT.personalImpression,
      portrait: { id: portraitMediaId },
      speciesOverride: { id: speciesId },
      status: "other",
      statusCustomText: SPOILER_TEXT.statusCustomText,
    });
    expect(appearance.roles.map((role: { roleType: string }) => role.roleType).sort()).toEqual([
      "antagonist",
      "supporting",
    ]);
    expect(res.body.hiddenFields).toEqual([]);
    expect(aliasNamesOf(res)).toEqual(
      [
        PLAIN_ALIAS.book,
        PLAIN_ALIAS.global,
        SPOILER_TEXT.bookAlias,
        SPOILER_TEXT.globalAlias,
      ].sort(),
    );
  });

  it("reveals the global alias group without opening the book alias group", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const { characterId } = await createSpoiledCharacter({ bookId, token: accessToken, userId });

    const res = await contextualDetails({
      characterId,
      contextBookId: bookId,
      reveal: ["globalAliases"],
      token: accessToken,
    });

    expect(aliasNamesOf(res)).toEqual(
      [PLAIN_ALIAS.book, PLAIN_ALIAS.global, SPOILER_TEXT.globalAlias].sort(),
    );
    expect(res.body.hiddenFields).toContain("bookAliases");
    expect(res.body.hiddenFields).not.toContain("globalAliases");
    expect(JSON.stringify(res.body)).not.toContain(SPOILER_TEXT.bookAlias);
  });

  it("reveals the book alias group without opening the global alias group", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const { characterId } = await createSpoiledCharacter({ bookId, token: accessToken, userId });

    const res = await contextualDetails({
      characterId,
      contextBookId: bookId,
      reveal: ["bookAliases"],
      token: accessToken,
    });

    expect(aliasNamesOf(res)).toEqual(
      [PLAIN_ALIAS.book, PLAIN_ALIAS.global, SPOILER_TEXT.bookAlias].sort(),
    );
    expect(res.body.hiddenFields).toContain("globalAliases");
    expect(res.body.hiddenFields).not.toContain("bookAliases");
    expect(JSON.stringify(res.body)).not.toContain(SPOILER_TEXT.globalAlias);
  });

  it("never returns the aliases of an earlier series book inside the reading window, even with both groups revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId: firstBook, seriesId } = await createSeriesFirstBook(accessToken, "Dune Saga");
    const secondBook = await addSeriesBook(accessToken, seriesId, 2, "Dune Messiah");
    const characterId = await addCharacter({
      bookId: firstBook,
      name: "Paul Atreides",
      token: accessToken,
    });
    const linked = await authed("post", `/api/books/${secondBook}/characters`, accessToken).send({
      bookProfile: { importance: "central" },
      characterId,
      mode: "existing",
    });
    expect(linked.status).toBe(HttpStatus.CREATED);
    await replaceBookAliases({
      aliases: [
        { name: PLAIN_ALIAS.book, type: "nickname" },
        { isSpoiler: true, name: SPOILER_TEXT.bookAlias, type: "title" },
      ],
      bookId: firstBook,
      characterId,
      token: accessToken,
    });
    await replaceBookAliases({
      aliases: [
        { name: "The Preacher", type: "nickname" },
        { isSpoiler: true, name: "Blind Emperor", type: "title" },
      ],
      bookId: secondBook,
      characterId,
      token: accessToken,
    });

    const res = await contextualDetails({
      characterId,
      contextBookId: secondBook,
      reveal: ["bookAliases", "globalAliases"],
      token: accessToken,
    });

    expect(res.body.appearances).toHaveLength(2);
    expect(aliasNamesOf(res)).toEqual(["Blind Emperor", "The Preacher"]);
    expect(JSON.stringify(res.body)).not.toContain(PLAIN_ALIAS.book);
    expect(JSON.stringify(res.body)).not.toContain(SPOILER_TEXT.bookAlias);
  });
});

describe("stale spoiler flags without a value", () => {
  const staleProfile = {
    appearanceNotesIsSpoiler: true,
    descriptionIsSpoiler: true,
    displayNameIsSpoiler: true,
    personalImpressionIsSpoiler: true,
    portraitIsSpoiler: true,
    speciesOverrideIsSpoiler: true,
    statusIsSpoiler: true,
  };

  const hiddenFieldsByCharacter = (
    cards: readonly { characterId: string; hiddenFields: string[] }[],
  ): Record<string, string[]> =>
    Object.fromEntries(cards.map((card) => [card.characterId, card.hiddenFields]));

  it("lists no hiddenFields on the contextual details for flags that guard no value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await addCharacter({
      bookId,
      name: "Paul Atreides",
      profile: staleProfile,
      token: accessToken,
    });

    const res = await contextualDetails({ characterId, contextBookId: bookId, token: accessToken });

    expect(res.body.appearances[0]).toMatchObject({ ...staleProfile, hiddenFields: [] });
    expect(res.body.hiddenFields).toEqual([]);
  });

  it("lists no hiddenFields on the roster and summary cards for flags that guard no value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const staleId = await addCharacter({
      bookId,
      name: "Paul Atreides",
      profile: staleProfile,
      token: accessToken,
    });
    const spoiledId = await addCharacter({
      bookId,
      name: "Lady Jessica",
      profile: { ...staleProfile, displayName: "Reverend Mother", status: "unknown" },
      token: accessToken,
    });

    const listed = await roster(accessToken, bookId, `?contextBookId=${bookId}`);
    const recap = await summary(accessToken, bookId, `?contextBookId=${bookId}`);

    expect(hiddenFieldsByCharacter(listed.items)).toEqual({
      [spoiledId]: ["displayName", "status"],
      [staleId]: [],
    });
    expect(hiddenFieldsByCharacter(recap.top)).toEqual({
      [spoiledId]: ["displayName", "status"],
      [staleId]: [],
    });
  });
});
