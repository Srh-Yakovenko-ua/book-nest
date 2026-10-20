import type { CharacterFacetsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { CharacterFacetsViewSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { findSystemSpeciesId, seedSystemSpeciesCatalog } from "../../../test/system-species.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { TagsModule } from "../../tags/tags.module.js";
import { CharactersModule } from "../characters.module.js";

const IdBodySchema = z.object({ id: z.uuid() });

const NO_FACETS: CharacterFacetsView = {
  attitude: [],
  gender: [],
  group: [],
  importance: [],
  role: [],
  species: [],
  tag: [],
};

type TwoProfileSeed = {
  bookA: string;
  bookB: string;
  chaniGroup: string;
  darkElfSpecies: string;
  fremenTag: string;
  houseTag: string;
  humanSpecies: string;
  paulGroup: string;
};

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, TagsModule, CharactersModule]);
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

function addToBook(
  token: string,
  bookId: string,
  characterId: string,
  profile: Record<string, unknown> = {},
): Promise<string> {
  return createdId(
    authed("post", `/api/books/${bookId}/characters`, token).send({
      bookProfile: { importance: "supporting", ...profile },
      characterId,
      mode: "existing",
    }),
  );
}

async function archive(characterId: string): Promise<void> {
  await app
    .get(PrismaService)
    .character.update({ data: { archivedAt: new Date() }, where: { id: characterId } });
}

async function attachTags(
  token: string,
  bookId: string,
  characterId: string,
  tagIds: string[],
): Promise<void> {
  const res = await authed("patch", `/api/books/${bookId}/characters/${characterId}`, token).send({
    tagIds,
  });
  expect(res.status).toBe(HttpStatus.OK);
}

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function createBook(token: string, title: string): Promise<string> {
  return createdId(
    authed("post", "/api/books", token).send({
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title,
    }),
  );
}

async function createdId(pending: request.Test): Promise<string> {
  const res = await pending;
  expect(res.status).toBe(HttpStatus.CREATED);
  return IdBodySchema.parse(res.body).id;
}

function createGlobal(token: string, character: Record<string, unknown>): Promise<string> {
  return createdId(authed("post", "/api/characters", token).send({ character }));
}

function createGroup(
  token: string,
  name: string,
  members: Record<string, unknown>[],
): Promise<string> {
  return createdId(
    authed("post", "/api/character-groups", token).send({ members, name, type: "organization" }),
  );
}

function createInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<string> {
  return createdId(
    authed("post", `/api/books/${bookId}/characters`, token).send({
      bookProfile: { importance: "supporting", ...profile },
      character,
      mode: "new",
    }),
  );
}

function createTag(token: string, name: string): Promise<string> {
  return createdId(authed("post", "/api/tags", token).send({ name }));
}

async function facets(token: string, query = ""): Promise<CharacterFacetsView> {
  const res = await authed("get", `/api/characters/facets${query}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  return CharacterFacetsViewSchema.parse(res.body);
}

function paulOnlyFacets(seed: TwoProfileSeed): CharacterFacetsView {
  return {
    attitude: [{ count: 1, value: "like" }],
    gender: [{ count: 1, value: "male" }],
    group: [{ count: 1, value: seed.paulGroup }],
    importance: [{ count: 1, value: "central" }],
    role: [{ count: 1, value: "protagonist" }],
    species: [{ count: 1, value: seed.darkElfSpecies }],
    tag: [{ count: 1, value: seed.houseTag }],
  };
}

async function seedTwoProfiles(token: string): Promise<TwoProfileSeed> {
  await seedSystemSpeciesCatalog(app);
  const [darkElfSpecies, humanSpecies] = await Promise.all([
    findSystemSpeciesId({ app, key: "dark_elf" }),
    findSystemSpeciesId({ app, key: "human" }),
  ]);
  const bookA = await createBook(token, "Dune");
  const bookB = await createBook(token, "Dune Messiah");
  const paul = await createInBook(
    token,
    bookA,
    { gender: "male", globalAttitude: "like", name: "Paul Atreides", speciesId: darkElfSpecies },
    { importance: "central", roles: [{ roleType: "protagonist" }] },
  );
  await addToBook(token, bookB, paul, { importance: "central" });
  const chani = await createInBook(
    token,
    bookA,
    { gender: "female", globalAttitude: "hate", name: "Chani", speciesId: humanSpecies },
    { importance: "supporting", roles: [{ roleType: "love_interest" }] },
  );
  const houseTag = await createTag(token, "House");
  const fremenTag = await createTag(token, "Fremen");
  await attachTags(token, bookA, paul, [houseTag]);
  await attachTags(token, bookA, chani, [fremenTag]);
  const paulGroup = await createGroup(token, "House Atreides", [{ characterId: paul }]);
  const chaniGroup = await createGroup(token, "Sietch Tabr", [{ characterId: chani }]);
  return {
    bookA,
    bookB,
    chaniGroup,
    darkElfSpecies,
    fremenTag,
    houseTag,
    humanSpecies,
    paulGroup,
  };
}

async function trash(token: string, characterId: string): Promise<void> {
  const res = await authed("delete", `/api/characters/${characterId}?confirm=true`, token);
  expect(res.status).toBe(HttpStatus.OK);
}

describe("GET /api/characters/facets routing", () => {
  it("answers 200 with every facet instead of reading facets as a character id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", "/api/characters/facets", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(CharacterFacetsViewSchema.parse(res.body)).toEqual(NO_FACETS);
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/characters/facets");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

describe("GET /api/characters/facets self-exclusion", () => {
  it("still reports the female count while gender=male is selected", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { gender: "male", name: "Paul Atreides" });
    await createGlobal(accessToken, { gender: "male", name: "Stilgar" });
    await createGlobal(accessToken, { gender: "female", name: "Chani" });

    const result = await facets(accessToken, "?gender=male");

    expect(result.gender).toEqual([
      { count: 2, value: "male" },
      { count: 1, value: "female" },
    ]);
  });

  it("narrows the attitude counts to male characters under gender=male", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { gender: "male", globalAttitude: "like", name: "Paul" });
    await createGlobal(accessToken, { gender: "male", globalAttitude: "like", name: "Stilgar" });
    await createGlobal(accessToken, { gender: "female", globalAttitude: "like", name: "Chani" });
    await createGlobal(accessToken, { gender: "female", globalAttitude: "hate", name: "Irulan" });

    const result = await facets(accessToken, "?gender=male");

    expect(result.attitude).toEqual([{ count: 2, value: "like" }]);
  });

  it("omits a value whose count drops to zero under the other filters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { gender: "male", globalAttitude: "like", name: "Paul" });
    await createGlobal(accessToken, { gender: "female", globalAttitude: "hate", name: "Irulan" });

    const result = await facets(accessToken, "?attitude=like");

    expect(result.gender).toEqual([{ count: 1, value: "male" }]);
  });

  it("omits a character without an attitude or species from those facets", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGlobal(accessToken, { gender: "male", name: "Paul" });

    const result = await facets(accessToken);

    expect(result).toEqual({ ...NO_FACETS, gender: [{ count: 1, value: "male" }] });
  });
});

describe("GET /api/characters/facets catalog scope", () => {
  it("does not count archived, trashed or another user's characters", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await createGlobal(owner.accessToken, { gender: "male", name: "Paul Atreides" });
    await archive(await createGlobal(owner.accessToken, { gender: "female", name: "Chani" }));
    await trash(
      owner.accessToken,
      await createGlobal(owner.accessToken, { gender: "non_binary", name: "Hayt" }),
    );
    await createGlobal(stranger.accessToken, { gender: "unknown", name: "Leto" });

    const result = await facets(owner.accessToken);

    expect(result.gender).toEqual([{ count: 1, value: "male" }]);
  });

  it("counts only the archived characters under archived=true", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await createGlobal(owner.accessToken, { gender: "male", name: "Paul Atreides" });
    await archive(await createGlobal(owner.accessToken, { gender: "female", name: "Chani" }));
    await trash(
      owner.accessToken,
      await createGlobal(owner.accessToken, { gender: "non_binary", name: "Hayt" }),
    );
    await archive(await createGlobal(stranger.accessToken, { gender: "unknown", name: "Leto" }));

    const result = await facets(owner.accessToken, "?archived=true");

    expect(result.gender).toEqual([{ count: 1, value: "female" }]);
  });
});

describe("GET /api/characters/facets validation", () => {
  it("returns 404 for a context book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const strangersBook = await createBook(stranger.accessToken, "Dune");

    const res = await authed(
      "get",
      `/api/characters/facets?contextBookId=${strangersBook}`,
      owner.accessToken,
    );

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 400 naming gender for an unknown gender", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", "/api/characters/facets?gender=robot", accessToken);

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: expect.stringMatching(/^gender/) }),
      ]),
    );
  });
});

describe("GET /api/characters/facets distinct characters", () => {
  it("counts a character with the same importance in two books once", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createBook(accessToken, "Dune");
    const bookB = await createBook(accessToken, "Dune Messiah");
    const central = { importance: "central" };
    const paul = await createInBook(accessToken, bookA, { name: "Paul" }, central);
    await addToBook(accessToken, bookB, paul, central);
    await createInBook(accessToken, bookA, { name: "Chani" }, central);

    const result = await facets(accessToken);

    expect(result.importance).toEqual([{ count: 2, value: "central" }]);
  });

  it("counts a character with the same role in two books once", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createBook(accessToken, "Dune");
    const bookB = await createBook(accessToken, "Dune Messiah");
    const protagonist = { roles: [{ roleType: "protagonist" }] };
    const paul = await createInBook(accessToken, bookA, { name: "Paul" }, protagonist);
    await addToBook(accessToken, bookB, paul, protagonist);
    await createInBook(accessToken, bookA, { name: "Chani" }, protagonist);

    const result = await facets(accessToken);

    expect(result.role).toEqual([{ count: 2, value: "protagonist" }]);
  });

  it("counts a character that belongs to one group under two books once", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createBook(accessToken, "Dune");
    const bookB = await createBook(accessToken, "Dune Messiah");
    const paul = await createGlobal(accessToken, { name: "Paul" });
    const chani = await createGlobal(accessToken, { name: "Chani" });
    const groupId = await createGroup(accessToken, "Fremen", [
      { bookId: bookA, characterId: paul },
      { bookId: bookB, characterId: paul },
      { characterId: chani },
    ]);

    const result = await facets(accessToken);

    expect(result.group).toEqual([{ count: 2, value: groupId }]);
  });
});

describe("GET /api/characters/facets under contextBookId", () => {
  async function seedTwoBookAppearances(token: string): Promise<{ bookA: string }> {
    const bookA = await createBook(token, "Dune");
    const bookB = await createBook(token, "Dune Messiah");
    const paul = await createInBook(
      token,
      bookA,
      { name: "Paul" },
      { importance: "central", roles: [{ roleType: "protagonist" }] },
    );
    await addToBook(token, bookB, paul, {
      importance: "mentioned",
      roles: [{ roleType: "antagonist" }],
    });
    await createInBook(
      token,
      bookB,
      { name: "Chani" },
      { importance: "supporting", roles: [{ roleType: "love_interest" }] },
    );
    return { bookA };
  }

  it("counts importance only from the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA } = await seedTwoBookAppearances(accessToken);

    const result = await facets(accessToken, `?contextBookId=${bookA}`);

    expect(result.importance).toEqual([{ count: 1, value: "central" }]);
  });

  it("counts roles only from the context book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookA } = await seedTwoBookAppearances(accessToken);

    const result = await facets(accessToken, `?contextBookId=${bookA}`);

    expect(result.role).toEqual([{ count: 1, value: "protagonist" }]);
  });

  it("counts book-less and context-book memberships but not another book's", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookA = await createBook(accessToken, "Dune");
    const bookB = await createBook(accessToken, "Foundation");
    const stilgar = await createGlobal(accessToken, { name: "Stilgar" });
    const chani = await createGlobal(accessToken, { name: "Chani" });
    const hayt = await createGlobal(accessToken, { name: "Hayt" });
    const groupId = await createGroup(accessToken, "Fremen", [
      { bookId: bookA, characterId: stilgar },
      { characterId: chani },
      { bookId: bookB, characterId: hayt },
    ]);

    const result = await facets(accessToken, `?contextBookId=${bookA}`);

    expect(result.group).toEqual([{ count: 2, value: groupId }]);
  });
});

describe("GET /api/characters/facets spoilers", () => {
  async function seedSpoilerRole(token: string): Promise<void> {
    const bookId = await createBook(token, "Dune");
    await createInBook(
      token,
      bookId,
      { name: "Paul" },
      { roles: [{ isSpoiler: true, roleType: "antagonist" }, { roleType: "protagonist" }] },
    );
  }

  async function seedSpoilerMembership(token: string): Promise<string> {
    const paul = await createGlobal(token, { name: "Paul" });
    const chani = await createGlobal(token, { name: "Chani" });
    return createGroup(token, "Fremen", [
      { characterId: paul, isSpoiler: true },
      { characterId: chani },
    ]);
  }

  it("leaves a spoiler role out without includeSpoilerSearch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSpoilerRole(accessToken);

    const result = await facets(accessToken);

    expect(result.role).toEqual([{ count: 1, value: "protagonist" }]);
  });

  it("counts a spoiler role with includeSpoilerSearch=true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSpoilerRole(accessToken);

    const result = await facets(accessToken, "?includeSpoilerSearch=true");

    expect(result.role).toEqual([
      { count: 1, value: "antagonist" },
      { count: 1, value: "protagonist" },
    ]);
  });

  it("leaves a spoiler membership out without includeSpoilerSearch", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const groupId = await seedSpoilerMembership(accessToken);

    const result = await facets(accessToken);

    expect(result.group).toEqual([{ count: 1, value: groupId }]);
  });

  it("counts a spoiler membership with includeSpoilerSearch=true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const groupId = await seedSpoilerMembership(accessToken);

    const result = await facets(accessToken, "?includeSpoilerSearch=true");

    expect(result.group).toEqual([{ count: 2, value: groupId }]);
  });
});

describe("GET /api/characters/facets narrowing filters", () => {
  it("narrows every facet to the characters matching q", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTwoProfiles(accessToken);

    const result = await facets(accessToken, "?q=paul");

    expect(result).toEqual(paulOnlyFacets(seed));
  });

  it("narrows every facet to the possible duplicates", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTwoProfiles(accessToken);
    await createGlobal(accessToken, { name: "Paul Atreides" });

    const result = await facets(accessToken, "?possibleDuplicates=true");

    expect(result).toEqual({
      ...paulOnlyFacets(seed),
      gender: [
        { count: 1, value: "male" },
        { count: 1, value: "unknown" },
      ],
    });
  });

  it("narrows every facet to the characters in more than one book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTwoProfiles(accessToken);

    const result = await facets(accessToken, "?multipleBooks=true");

    expect(result).toEqual(paulOnlyFacets(seed));
  });

  it("counts both profiles without a narrowing filter", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seed = await seedTwoProfiles(accessToken);

    const result = await facets(accessToken);

    expect(result).toEqual({
      attitude: [
        { count: 1, value: "hate" },
        { count: 1, value: "like" },
      ],
      gender: [
        { count: 1, value: "female" },
        { count: 1, value: "male" },
      ],
      group: expect.arrayContaining([
        { count: 1, value: seed.chaniGroup },
        { count: 1, value: seed.paulGroup },
      ]),
      importance: [
        { count: 1, value: "central" },
        { count: 1, value: "supporting" },
      ],
      role: [
        { count: 1, value: "love_interest" },
        { count: 1, value: "protagonist" },
      ],
      species: expect.arrayContaining([
        { count: 1, value: seed.darkElfSpecies },
        { count: 1, value: seed.humanSpecies },
      ]),
      tag: expect.arrayContaining([
        { count: 1, value: seed.fremenTag },
        { count: 1, value: seed.houseTag },
      ]),
    });
  });
});
