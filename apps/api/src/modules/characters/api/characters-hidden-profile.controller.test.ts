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

async function createCharacter({
  hideProfileAsSpoiler = false,
  name,
  token,
}: {
  hideProfileAsSpoiler?: boolean;
  name: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({
    character: { hideProfileAsSpoiler, name },
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  expect(res.body.hideProfileAsSpoiler).toBe(hideProfileAsSpoiler);
  return res.body.id;
}

async function createRelationship({
  bookId,
  sourceCharacterId,
  targetCharacterId,
  token,
}: {
  bookId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  token: string;
}): Promise<string> {
  const res = await authed("post", "/api/character-relationships", token).send({
    category: "social",
    directionality: "symmetric",
    initialBookStates: [{ bookId, status: "active" }],
    sourceCharacterId,
    targetCharacterId,
    type: "friend_of",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function linkCharacter({
  bookId,
  bookProfile,
  characterId,
  token,
}: {
  bookId: string;
  bookProfile: Record<string, unknown>;
  characterId: string;
  token: string;
}): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile,
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

function listedIds(res: request.Response): string[] {
  return res.body.items.map((item: { id: string }) => item.id);
}

describe("whole-profile hidden characters — global list and reveal", () => {
  it("excludes a hidden-profile character from the list, includes it only with the reveal flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const visible = await createCharacter({ name: "Ned Stark", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Jon Snow",
      token: accessToken,
    });

    const byDefault = await authed("get", "/api/characters", accessToken);
    expect(byDefault.status).toBe(HttpStatus.OK);
    expect(listedIds(byDefault)).toContain(visible);
    expect(listedIds(byDefault)).not.toContain(hidden);

    const revealed = await authed("get", "/api/characters?includeHiddenProfiles=true", accessToken);
    expect(revealed.status).toBe(HttpStatus.OK);
    expect(listedIds(revealed)).toEqual(expect.arrayContaining([visible, hidden]));

    const hiddenItem = revealed.body.items.find((item: { id: string }) => item.id === hidden);
    const visibleItem = revealed.body.items.find((item: { id: string }) => item.id === visible);
    expect(hiddenItem.hideProfileAsSpoiler).toBe(true);
    expect(visibleItem.hideProfileAsSpoiler).toBe(false);
  });
});

describe("whole-profile hidden characters — details 404 and reveal", () => {
  it("returns 404 for a hidden-profile character unless the owner reveals it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const visible = await createCharacter({ name: "Ned Stark", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Jon Snow",
      token: accessToken,
    });

    const blocked = await authed("get", `/api/characters/${hidden}`, accessToken);
    expect(blocked.status).toBe(HttpStatus.NOT_FOUND);

    const revealed = await authed(
      "get",
      `/api/characters/${hidden}?includeHiddenProfiles=true`,
      accessToken,
    );
    expect(revealed.status).toBe(HttpStatus.OK);
    expect(revealed.body).toMatchObject({ hideProfileAsSpoiler: true, name: "Jon Snow" });

    const unaffected = await authed("get", `/api/characters/${visible}`, accessToken);
    expect(unaffected.status).toBe(HttpStatus.OK);
    expect(unaffected.body.hideProfileAsSpoiler).toBe(false);
  });
});

describe("whole-profile hidden characters — book roster and book details", () => {
  it("drops a hidden-profile character from the roster and 404s its book-scoped details", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const visible = await createCharacter({ name: "Ned Stark", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Jon Snow",
      token: accessToken,
    });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId: visible,
      token: accessToken,
    });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId: hidden,
      token: accessToken,
    });

    const roster = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    expect(roster.status).toBe(HttpStatus.OK);
    const rosterCharacterIds = roster.body.items.map(
      (item: { characterId: string }) => item.characterId,
    );
    expect(rosterCharacterIds).toContain(visible);
    expect(rosterCharacterIds).not.toContain(hidden);

    const hiddenDetails = await authed(
      "get",
      `/api/books/${bookId}/characters/${hidden}`,
      accessToken,
    );
    expect(hiddenDetails.status).toBe(HttpStatus.NOT_FOUND);

    const visibleDetails = await authed(
      "get",
      `/api/books/${bookId}/characters/${visible}`,
      accessToken,
    );
    expect(visibleDetails.status).toBe(HttpStatus.OK);
  });
});

describe("whole-profile hidden characters — suggestions and duplicate candidates", () => {
  it("never suggests a hidden-profile character for linking into a book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const suggestable = await createCharacter({ name: "Robb Stark", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Jon Snow",
      token: accessToken,
    });

    const res = await authed("get", `/api/books/${bookId}/character-suggestions`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const suggestedIds = res.body.suggestions.map((row: { id: string }) => row.id);
    expect(suggestedIds).toContain(suggestable);
    expect(suggestedIds).not.toContain(hidden);
  });

  it("omits a hidden-profile character from duplicate candidates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const visible = await createCharacter({ name: "Twin", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Twin",
      token: accessToken,
    });

    const res = await authed("get", "/api/characters/duplicate-candidates?name=Twin", accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const candidateIds = res.body.candidates.map((row: { id: string }) => row.id);
    expect(candidateIds).toContain(visible);
    expect(candidateIds).not.toContain(hidden);
  });

  it("does not flag a visible character as a possible duplicate of a hidden twin", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const visible = await createCharacter({ name: "Twin", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Twin",
      token: accessToken,
    });

    const byDefault = await authed("get", "/api/characters?possibleDuplicates=true", accessToken);
    expect(byDefault.status).toBe(HttpStatus.OK);
    expect(listedIds(byDefault)).not.toContain(visible);
    expect(listedIds(byDefault)).not.toContain(hidden);

    const revealed = await authed(
      "get",
      "/api/characters?possibleDuplicates=true&includeHiddenProfiles=true",
      accessToken,
    );
    expect(revealed.status).toBe(HttpStatus.OK);
    expect(listedIds(revealed)).toEqual(expect.arrayContaining([visible, hidden]));
  });
});

describe("whole-profile hidden characters — summary counts", () => {
  it("does not let a hidden-profile character inflate the book summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const visible = await createCharacter({ name: "Ned Stark", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Jon Snow",
      token: accessToken,
    });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId: visible,
      token: accessToken,
    });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId: hidden,
      token: accessToken,
    });

    const res = await authed("get", `/api/books/${bookId}/character-summary`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalVisibleCharacters).toBe(1);
    expect(res.body.byImportance.central).toBe(1);
    expect(res.body.hasHiddenRecords).toBe(false);
    const topIds = res.body.top.map((entry: { characterId: string }) => entry.characterId);
    expect(topIds).toEqual([visible]);
  });
});

describe("whole-profile hidden characters — graph", () => {
  it("drops the hidden node and every edge touching it, without inflating degree", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter({ name: "Alice", token: accessToken });
    const bob = await createCharacter({ name: "Bob", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Hidden",
      token: accessToken,
    });
    for (const characterId of [alice, bob, hidden]) {
      await linkCharacter({
        bookId,
        bookProfile: { importance: "central" },
        characterId,
        token: accessToken,
      });
    }
    await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: bob,
      token: accessToken,
    });
    await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: hidden,
      token: accessToken,
    });

    const res = await authed("get", `/api/books/${bookId}/character-graph`, accessToken);
    expect(res.status).toBe(HttpStatus.OK);
    const nodeIds = res.body.nodes.map((node: { id: string }) => node.id);
    expect(nodeIds).toEqual(expect.arrayContaining([alice, bob]));
    expect(nodeIds).not.toContain(hidden);
    expect(res.body.edges).toHaveLength(1);
    expect([res.body.edges[0].source, res.body.edges[0].target].sort()).toEqual(
      [alice, bob].sort(),
    );
    const aliceNode = res.body.nodes.find((node: { id: string }) => node.id === alice);
    expect(aliceNode.degree).toBe(1);
  });
});

describe("whole-profile hidden characters — relationship endpoints", () => {
  it("drops relationships whose endpoint is a hidden-profile character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter({ name: "Alice", token: accessToken });
    const bob = await createCharacter({ name: "Bob", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Hidden",
      token: accessToken,
    });
    for (const characterId of [alice, bob, hidden]) {
      await linkCharacter({
        bookId,
        bookProfile: { importance: "central" },
        characterId,
        token: accessToken,
      });
    }
    const visibleRelationship = await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: bob,
      token: accessToken,
    });
    const hiddenRelationship = await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: hidden,
      token: accessToken,
    });

    const list = await authed("get", `/api/books/${bookId}/character-relationships`, accessToken);
    expect(list.status).toBe(HttpStatus.OK);
    const endpointIds = list.body.flatMap(
      (view: { relationship: { sourceCharacterId: string; targetCharacterId: string } }) => [
        view.relationship.sourceCharacterId,
        view.relationship.targetCharacterId,
      ],
    );
    expect(endpointIds).not.toContain(hidden);

    const hiddenDetails = await authed(
      "get",
      `/api/character-relationships/${hiddenRelationship}`,
      accessToken,
    );
    expect(hiddenDetails.status).toBe(HttpStatus.NOT_FOUND);

    const visibleDetails = await authed(
      "get",
      `/api/character-relationships/${visibleRelationship}`,
      accessToken,
    );
    expect(visibleDetails.status).toBe(HttpStatus.OK);
  });
});

describe("whole-profile hidden characters — relationship path finder", () => {
  it("hides a bridge through a hidden character and 404s a path to a hidden endpoint", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const alice = await createCharacter({ name: "Alice", token: accessToken });
    const bob = await createCharacter({ name: "Bob", token: accessToken });
    const carol = await createCharacter({ name: "Carol", token: accessToken });
    const hidden = await createCharacter({
      hideProfileAsSpoiler: true,
      name: "Hidden",
      token: accessToken,
    });
    for (const characterId of [alice, bob, carol, hidden]) {
      await linkCharacter({
        bookId,
        bookProfile: { importance: "central" },
        characterId,
        token: accessToken,
      });
    }
    await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: bob,
      token: accessToken,
    });
    await createRelationship({
      bookId,
      sourceCharacterId: alice,
      targetCharacterId: hidden,
      token: accessToken,
    });
    await createRelationship({
      bookId,
      sourceCharacterId: hidden,
      targetCharacterId: carol,
      token: accessToken,
    });

    const direct = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${bob}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(direct.status).toBe(HttpStatus.OK);
    expect(direct.body.found).toBe(true);

    const bridged = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${carol}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(bridged.status).toBe(HttpStatus.OK);
    expect(bridged.body.found).toBe(false);

    const toHidden = await authed(
      "get",
      `/api/character-relationships/path?fromId=${alice}&toId=${hidden}&contextBookId=${bookId}`,
      accessToken,
    );
    expect(toHidden.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("whole-profile hidden characters — create and PATCH toggles", () => {
  it("toggles list visibility through the global PATCH flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const characterId = await createCharacter({ name: "Ned Stark", token: accessToken });

    const initialList = await authed("get", "/api/characters", accessToken);
    expect(listedIds(initialList)).toContain(characterId);

    const hide = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      hideProfileAsSpoiler: true,
    });
    expect(hide.status).toBe(HttpStatus.OK);
    expect(hide.body.hideProfileAsSpoiler).toBe(true);

    const afterHide = await authed("get", "/api/characters", accessToken);
    expect(listedIds(afterHide)).not.toContain(characterId);
    const revealed = await authed("get", "/api/characters?includeHiddenProfiles=true", accessToken);
    expect(listedIds(revealed)).toContain(characterId);

    const unhide = await authed("patch", `/api/characters/${characterId}`, accessToken).send({
      hideProfileAsSpoiler: false,
    });
    expect(unhide.status).toBe(HttpStatus.OK);
    expect(unhide.body.hideProfileAsSpoiler).toBe(false);

    const afterUnhide = await authed("get", "/api/characters", accessToken);
    expect(listedIds(afterUnhide)).toContain(characterId);
  });
});

describe("whole-profile hidden characters — regression for unflagged characters", () => {
  it("leaves characters without the flag fully visible everywhere", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createCharacter({ name: "Ned Stark", token: accessToken });
    await linkCharacter({
      bookId,
      bookProfile: { importance: "central" },
      characterId,
      token: accessToken,
    });

    const list = await authed("get", "/api/characters", accessToken);
    expect(listedIds(list)).toContain(characterId);
    const listedCharacter = list.body.items.find((item: { id: string }) => item.id === characterId);
    expect(listedCharacter.hideProfileAsSpoiler).toBe(false);

    const details = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(details.status).toBe(HttpStatus.OK);
    expect(details.body.hideProfileAsSpoiler).toBe(false);

    const roster = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    const rosterCharacterIds = roster.body.items.map(
      (item: { characterId: string }) => item.characterId,
    );
    expect(rosterCharacterIds).toContain(characterId);
  });
});
