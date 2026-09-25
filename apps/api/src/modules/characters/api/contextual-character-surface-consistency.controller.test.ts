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
  character,
  homeBook,
  name,
  profile,
  token,
}: {
  character?: Record<string, unknown>;
  homeBook?: "first" | "second";
  name: string;
  profile?: Record<string, unknown>;
  token: string;
}): Promise<ContextualSubject> {
  const series = await createSeries(token);
  const bookId = homeBook === "first" ? series.firstBook : series.secondBook;
  const characterId = await addCharacter({ bookId, character, name, profile, token });

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
  readingPosition,
  subject,
  token,
}: {
  contextBookId: string;
  readingPosition: string;
  subject: ContextualSubject;
  token: string;
}): Promise<SurfaceReveal> {
  const query = `contextBookId=${contextBookId}${
    readingPosition === "" ? "" : `&${readingPosition}`
  }`;
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
  readingPosition,
  subject,
  token,
}: {
  contextBookId: string;
  readingPosition: string;
  subject: ContextualSubject;
  token: string;
}): Promise<string> {
  const query = `contextBookId=${contextBookId}${
    readingPosition === "" ? "" : `&${readingPosition}`
  }`;
  const responses = await Promise.all([
    authed("get", `/api/books/${contextBookId}/characters?${query}`, token),
    authed("get", `/api/series/${subject.seriesId}/characters?${query}`, token),
    authed("get", `/api/series/${subject.seriesId}/character-summary?${query}`, token),
    authed("get", `/api/character-groups/${subject.groupId}?${query}`, token),
    authed("get", `/api/character-theories?${query}`, token),
  ]);
  return JSON.stringify(responses.map((response) => response.body));
}

describe("contextual character surfaces agree on one visible set", () => {
  it("agrees that an unreached chapter hides every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextChapter=5",
      subject,
      token: accessToken,
    });
    expect(unreached).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextChapter=5",
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);
    expect(serialized).not.toContain(SUBJECT_THEORY_TEXT);

    const reached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextChapter=40",
      subject,
      token: accessToken,
    });
    expect(reached).toEqual(ALL_SURFACES_VISIBLE);
  });

  it("agrees that an unreached page hides every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearancePage: 420 },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextPage=50",
      subject,
      token: accessToken,
    });
    expect(unreached).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextPage=50",
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);

    const reached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextPage=420",
      subject,
      token: accessToken,
    });
    expect(reached).toEqual(ALL_SURFACES_VISIBLE);
  });

  it("agrees that an unreached audiobook position hides every contextual surface", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceAudioSeconds: 36000 },
      token: accessToken,
    });

    const unreached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextAudioSeconds=600",
      subject,
      token: accessToken,
    });
    expect(unreached).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextAudioSeconds=600",
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);

    const reached = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextAudioSeconds=36000",
      subject,
      token: accessToken,
    });
    expect(reached).toEqual(ALL_SURFACES_VISIBLE);
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
      readingPosition: "contextChapter=99",
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
    const serialized = await serializedSurfaces({
      contextBookId: subject.firstBook,
      readingPosition: "contextChapter=99",
      subject,
      token: accessToken,
    });
    expect(serialized).not.toContain(subject.name);
  });

  it("agrees that an earlier part's character stays visible while the context book is gated", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      homeBook: "first",
      name: "Paul Atreides",
      profile: { firstAppearanceChapter: "30" },
      token: accessToken,
    });

    const reveal = await revealAcrossSurfaces({
      contextBookId: subject.secondBook,
      readingPosition: "contextChapter=5",
      subject,
      token: accessToken,
    });
    expect(reveal).toEqual({ ...ALL_SURFACES_VISIBLE, bookRoster: false });
  });

  it("agrees that a presence-hidden character is never revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });

    for (const readingPosition of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
      const serialized = await serializedSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(serialized).not.toContain(subject.name);
    }
  });

  it("agrees that a profile-hidden character is never revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      character: { hideProfileAsSpoiler: true },
      name: "Leto II",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    for (const readingPosition of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
      const serialized = await serializedSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(serialized).not.toContain(subject.name);
    }
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

    for (const readingPosition of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
      const serialized = await serializedSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(serialized).not.toContain(subject.name);
      expect(serialized).not.toContain(SUBJECT_THEORY_TEXT);
    }
  });

  it("agrees that trashing the only book of a presence-hidden character reveals nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      homeBook: "first",
      name: "The Traitor",
      profile: { firstAppearanceChapter: "1", hidePresenceAsSpoiler: true },
      token: accessToken,
    });
    const trashed = await authed("delete", `/api/books/${subject.firstBook}`, accessToken);
    expect(trashed.status).toBe(HttpStatus.OK);

    for (const readingPosition of ["", "contextChapter=1", "contextChapter=99"]) {
      const reveal = await revealAcrossSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(reveal).toEqual(ALL_SURFACES_HIDDEN);
      const serialized = await serializedSurfaces({
        contextBookId: subject.secondBook,
        readingPosition,
        subject,
        token: accessToken,
      });
      expect(serialized).not.toContain(subject.name);
    }
  });

  it("agrees that a profile-hidden character is not named without a reading context either", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      character: { hideProfileAsSpoiler: true },
      name: "Leto II",
      profile: { firstAppearanceChapter: "1" },
      token: accessToken,
    });

    const [details, group, theories] = await Promise.all([
      authed("get", `/api/characters/${subject.characterId}`, accessToken),
      authed("get", `/api/character-groups/${subject.groupId}`, accessToken),
      authed("get", "/api/character-theories", accessToken),
    ]);

    expect(details.status).toBe(HttpStatus.NOT_FOUND);
    expect(group.status).toBe(HttpStatus.OK);
    expect(group.body.memberCount).toBe(0);
    expect(group.body.members).toEqual([]);
    expect(theories.status).toBe(HttpStatus.OK);
    expect(
      theories.body.items.some(
        (theory: { characterId: null | string }) => theory.characterId === subject.characterId,
      ),
    ).toBe(false);
    expect(JSON.stringify([details.body, group.body, theories.body])).not.toContain(subject.name);
  });

  it("rejects a reading position on every contextual surface unless the context book is named", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const subject = await createSubject({
      name: "Alia Atreides",
      profile: { firstAppearanceChapter: "40" },
      token: accessToken,
    });

    const anchoredToPathBook = await authed(
      "get",
      `/api/books/${subject.secondBook}/characters?contextChapter=5`,
      accessToken,
    );
    expect(anchoredToPathBook.status).toBe(HttpStatus.OK);
    expect(listsCharacter(anchoredToPathBook.body.items, subject.characterId)).toBe(false);

    for (const path of [
      `/api/series/${subject.seriesId}/characters?contextChapter=5`,
      `/api/series/${subject.seriesId}/character-summary?contextChapter=5`,
      `/api/series/${subject.seriesId}/characters/${subject.characterId}?contextChapter=5`,
      `/api/characters/${subject.characterId}?contextChapter=5`,
      `/api/character-groups/${subject.groupId}?contextChapter=5`,
      "/api/character-theories?contextChapter=5",
    ]) {
      const bare = await authed("get", path, accessToken);
      expect(bare.status).toBe(HttpStatus.BAD_REQUEST);
      expect(bare.body.errorsMessages).toEqual([
        {
          field: "contextBookId",
          message: "contextBookId is required when a reading position is supplied",
        },
      ]);
    }
  });
});
