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

type ContextualSubject = {
  characterId: string;
  firstBook: string;
  groupId: string;
  name: string;
  secondBook: string;
  seriesId: string;
};

type SeriesSetup = { firstBook: string; secondBook: string; seriesId: string };

type SurfaceReveal = {
  bookRoster: boolean;
  details: boolean;
  groupDetails: boolean;
  seriesProfile: boolean;
  seriesRoster: boolean;
  seriesSummaryTop: boolean;
  theories: boolean;
};

const ALL_SURFACES_HIDDEN: SurfaceReveal = {
  bookRoster: false,
  details: false,
  groupDetails: false,
  seriesProfile: false,
  seriesRoster: false,
  seriesSummaryTop: false,
  theories: false,
};

const ALL_SURFACES_VISIBLE: SurfaceReveal = {
  bookRoster: true,
  details: true,
  groupDetails: true,
  seriesProfile: true,
  seriesRoster: true,
  seriesSummaryTop: true,
  theories: true,
};

const SUBJECT_THEORY_TEXT = "The heir returns under another name";

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

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
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
  const secondBook = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    bookType: "series_part",
    ownershipStatus: "owned",
    partNumber: 2,
    seriesId: res.body.series.id,
    title: "Dune Messiah",
  });
  expect(secondBook.status).toBe(HttpStatus.CREATED);
  return {
    firstBook: res.body.id,
    secondBook: secondBook.body.id,
    seriesId: res.body.series.id,
  };
}

async function createSubject({
  homeBook,
  name,
  profile,
  token,
}: {
  homeBook?: "first" | "second";
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<ContextualSubject> {
  const series = await createSeries(token);
  const bookId = homeBook === "first" ? series.firstBook : series.secondBook;
  const characterId = await addCharacter({ bookId, name, profile, token });

  const group = await authed("post", "/api/character-groups", token).send({
    members: [{ characterId }],
    name: "The Fremen",
    type: "order",
  });
  expect(group.status).toBe(HttpStatus.CREATED);

  const theory = await authed("post", "/api/character-theories", token).send({
    characterId,
    text: SUBJECT_THEORY_TEXT,
  });
  expect(theory.status).toBe(HttpStatus.CREATED);

  return { ...series, characterId, groupId: group.body.id, name };
}

function listsCharacter(items: { characterId: string }[], characterId: string): boolean {
  return items.some((item) => item.characterId === characterId);
}

async function revealAcrossSurfaces({
  contextBookId,
  subject,
  token,
}: {
  contextBookId: string;
  subject: ContextualSubject;
  token: string;
}): Promise<SurfaceReveal> {
  const query = `contextBookId=${contextBookId}`;
  const [bookRoster, seriesRoster, seriesSummary, seriesProfile, details, group, theories] =
    await Promise.all([
      authed("get", `/api/books/${contextBookId}/characters?${query}`, token),
      authed("get", `/api/series/${subject.seriesId}/characters?${query}`, token),
      authed("get", `/api/series/${subject.seriesId}/character-summary?${query}`, token),
      authed(
        "get",
        `/api/series/${subject.seriesId}/characters/${subject.characterId}?${query}`,
        token,
      ),
      authed("get", `/api/characters/${subject.characterId}?${query}`, token),
      authed("get", `/api/character-groups/${subject.groupId}?${query}`, token),
      authed("get", `/api/character-theories?${query}`, token),
    ]);

  for (const listing of [bookRoster, seriesRoster, seriesSummary, group, theories]) {
    expect(listing.status).toBe(HttpStatus.OK);
  }
  for (const gated of [details, seriesProfile]) {
    expect([HttpStatus.OK, HttpStatus.NOT_FOUND]).toContain(gated.status);
  }

  return {
    bookRoster: listsCharacter(bookRoster.body.items, subject.characterId),
    details: details.status === HttpStatus.OK,
    groupDetails: group.body.members.some(
      (member: { characterId: string }) => member.characterId === subject.characterId,
    ),
    seriesProfile: seriesProfile.status === HttpStatus.OK,
    seriesRoster: listsCharacter(seriesRoster.body.items, subject.characterId),
    seriesSummaryTop: listsCharacter(seriesSummary.body.top, subject.characterId),
    theories: theories.body.items.some(
      (theory: { characterId: null | string }) => theory.characterId === subject.characterId,
    ),
  };
}

async function serializedSurfaces({
  contextBookId,
  subject,
  token,
}: {
  contextBookId: string;
  subject: ContextualSubject;
  token: string;
}): Promise<string> {
  const query = `contextBookId=${contextBookId}`;
  const responses = await Promise.all([
    authed("get", `/api/books/${contextBookId}/characters?${query}`, token),
    authed("get", `/api/series/${subject.seriesId}/characters?${query}`, token),
    authed("get", `/api/series/${subject.seriesId}/character-summary?${query}`, token),
    authed("get", `/api/character-groups/${subject.groupId}?${query}`, token),
    authed("get", `/api/character-theories?${query}`, token),
  ]);
  return JSON.stringify(responses.map((response) => response.body));
}

async function suggestsCharacter({
  characterId,
  contextBookId,
  targetBookId,
  token,
}: {
  characterId: string;
  contextBookId: string;
  targetBookId: string;
  token: string;
}): Promise<boolean> {
  const query = `contextBookId=${contextBookId}`;
  const res = await authed(
    "get",
    `/api/books/${targetBookId}/character-suggestions?${query}`,
    token,
  );
  expect(res.status).toBe(HttpStatus.OK);
  return res.body.suggestions.some((row: { id: string }) => row.id === characterId);
}

describe("book character suggestions join the contextual surfaces", () => {
  it("suggests the subject for a sibling part exactly when the other surfaces reveal it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const agreements: { revealed: boolean; suggested: boolean }[] = [];
    for (const contextBookId of [subject.firstBook, subject.secondBook]) {
      const reveal = await revealAcrossSurfaces({ contextBookId, subject, token: accessToken });
      const suggested = await suggestsCharacter({
        characterId: subject.characterId,
        contextBookId,
        targetBookId: subject.firstBook,
        token: accessToken,
      });
      agreements.push({ revealed: reveal.seriesRoster, suggested });
    }

    expect(agreements).toEqual([
      { revealed: false, suggested: false },
      { revealed: true, suggested: true },
    ]);
  });

  it("never suggests a future part's character into an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    const suggested = await suggestsCharacter({
      characterId: subject.characterId,
      contextBookId: subject.firstBook,
      targetBookId: subject.firstBook,
      token: accessToken,
    });
    expect(suggested).toBe(false);
  });
});

describe("contextual character surfaces agree on one visible set", () => {
  it("agrees that a late first-appearance chapter hides no contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_VISIBLE);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(serialized).toContain(subject.name);
    expect(serialized).toContain(SUBJECT_THEORY_TEXT);
  });

  it("agrees that a late first-appearance page hides no contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_VISIBLE);
  });

  it("agrees that a late audiobook first appearance hides no contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_VISIBLE);
  });

  it("agrees that a future part's character is never revealed from an earlier part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.firstBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.firstBook,
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);
  });

  it("agrees that an earlier part's character stays visible from a later part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      homeBook: "first",
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual({ ...ALL_SURFACES_VISIBLE, bookRoster: false });
  });

  it("agrees that a character unlinked from every book is never revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const unlinked = await authed(
      "delete",
      `/api/books/${subject.secondBook}/characters/${subject.characterId}`,
      accessToken,
    );
    expect(unlinked.status).toBe(HttpStatus.NO_CONTENT);

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);
    expect(serialized).not.toContain(SUBJECT_THEORY_TEXT);
  });

  it("agrees that trashing the only book of a character reveals nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      homeBook: "first",
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });
    const beforeTrash = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(beforeTrash).toEqual({ ...ALL_SURFACES_VISIBLE, bookRoster: false });

    const trashed = await authed("delete", `/api/books/${subject.firstBook}`, accessToken);
    expect(trashed.status).toBe(HttpStatus.OK);

    const afterTrash = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(afterTrash).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);
  });

  it("names the character on details, group and theories without a reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Leto II",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const [details, group, theories] = await Promise.all([
      authed("get", `/api/characters/${subject.characterId}`, accessToken),
      authed("get", `/api/character-groups/${subject.groupId}`, accessToken),
      authed("get", "/api/character-theories", accessToken),
    ]);

    expect(details.status).toBe(HttpStatus.OK);
    expect(details.body.name).toBe("Leto II");
    expect(group.status).toBe(HttpStatus.OK);
    expect(group.body.memberCount).toBe(1);
    expect(group.body.members.map((member: { characterId: string }) => member.characterId)).toEqual(
      [subject.characterId],
    );
    expect(theories.status).toBe(HttpStatus.OK);
    expect(
      theories.body.items.map((theory: { characterId: null | string }) => theory.characterId),
    ).toEqual([subject.characterId]);
  });
});
