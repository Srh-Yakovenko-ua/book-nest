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

type AliasView = {
  bookId: null | string;
  id: string;
  isSpoiler: boolean;
  name: string;
  position: number;
  type: string;
};

type RoleView = {
  customRole: null | string;
  id: string;
  isSpoiler: boolean;
  position: number;
  roleType: string;
};

const EVERY_REVEAL_FIELD_ID = [
  "aliases",
  "appearanceNotes",
  "description",
  "displayName",
  "personalImpression",
  "portrait",
  "roles",
  "speciesOverride",
  "status",
];

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

function authed(method: "get" | "patch" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function contextualPath({
  characterId,
  contextBookId,
  revealFieldIds = [],
}: {
  characterId: string;
  contextBookId: string;
  revealFieldIds?: readonly string[];
}): string {
  const reveals = revealFieldIds.map((fieldId) => `&revealFieldIds=${fieldId}`).join("");
  return `/api/characters/${characterId}?contextBookId=${contextBookId}${reveals}`;
}

async function createBook(token: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting", ...profile },
    character,
    mode: "new",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function patchBookCharacter(
  token: string,
  bookId: string,
  characterId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await authed("patch", `/api/books/${bookId}/characters/${characterId}`, token).send(
    body,
  );
  expect(res.status).toBe(HttpStatus.OK);
}

async function patchCharacter(
  token: string,
  characterId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await authed("patch", `/api/characters/${characterId}`, token).send(body);
  expect(res.status).toBe(HttpStatus.OK);
}

async function readAsEditPage(
  token: string,
  characterId: string,
  contextBookId: string,
): Promise<request.Response> {
  const res = await authed(
    "get",
    `${contextualPath({ characterId, contextBookId, revealFieldIds: EVERY_REVEAL_FIELD_ID })}&includeHiddenProfiles=true`,
    token,
  );
  expect(res.status).toBe(HttpStatus.OK);
  return res;
}

const toRoleUpdate = (role: RoleView): Record<string, unknown> => ({
  customRole: role.customRole,
  isSpoiler: role.isSpoiler,
  position: role.position,
  roleType: role.roleType,
});

const toAliasUpdate = (alias: AliasView): Record<string, unknown> => ({
  isSpoiler: alias.isSpoiler,
  name: alias.name,
  position: alias.position,
  type: alias.type,
});

const rolesOf = (res: request.Response): RoleView[] => res.body.appearances[0].roles;

const aliasesScopedTo = (res: request.Response, bookId: null | string): AliasView[] =>
  res.body.aliases.filter((alias: AliasView) => alias.bookId === bookId);

const roleTypesOf = (roles: readonly RoleView[]): string[] =>
  roles.map((role) => role.roleType).sort();

const aliasNamesOf = (aliases: readonly AliasView[]): string[] =>
  aliases.map((alias) => alias.name).sort();

const spoilerRoleProfile = {
  roles: [{ roleType: "supporting" }, { isSpoiler: true, roleType: "antagonist" }],
};

const spoilerBookAliases = [
  { name: "BookMuad", type: "title" },
  { isSpoiler: true, name: "BookLisan", type: "title" },
];

const spoilerGlobalAliases = [
  { name: "GlobalUsul", type: "nickname" },
  { isSpoiler: true, name: "GlobalLisan", type: "nickname" },
];

describe("spoiler book character roles in the contextual read", () => {
  it("withholds a spoiler role and names roles in the appearance hiddenFields when roles are not revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      spoilerRoleProfile,
    );

    const res = await authed(
      "get",
      contextualPath({ characterId, contextBookId: bookId }),
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(roleTypesOf(rolesOf(res))).toEqual(["supporting"]);
    expect(res.body.appearances[0].hiddenFields).toContain("roles");
  });

  it("returns every role with its spoiler flag and drops roles from hiddenFields when roles are revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      spoilerRoleProfile,
    );

    const res = await authed(
      "get",
      contextualPath({ characterId, contextBookId: bookId, revealFieldIds: ["roles"] }),
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(roleTypesOf(rolesOf(res))).toEqual(["antagonist", "supporting"]);
    expect(rolesOf(res).find((role) => role.roleType === "antagonist")?.isSpoiler).toBe(true);
    expect(res.body.appearances[0].hiddenFields).not.toContain("roles");
  });

  it("keeps a spoiler role alive when the edit page reads with every reveal key and saves the roles it got back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      spoilerRoleProfile,
    );

    const beforeSave = await readAsEditPage(accessToken, characterId, bookId);
    expect(roleTypesOf(rolesOf(beforeSave))).toEqual(["antagonist", "supporting"]);

    await patchBookCharacter(accessToken, bookId, characterId, {
      personalImpression: "Grows into the role of Emperor",
      roles: rolesOf(beforeSave).map((role) => toRoleUpdate(role)),
    });

    const afterSave = await readAsEditPage(accessToken, characterId, bookId);
    expect(roleTypesOf(rolesOf(afterSave))).toEqual(["antagonist", "supporting"]);
    expect(rolesOf(afterSave).find((role) => role.roleType === "antagonist")?.isSpoiler).toBe(true);
    expect(afterSave.body.appearances[0].personalImpression).toBe("Grows into the role of Emperor");
  });

  it("leaves the stored roles untouched when the update body omits roles entirely", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      spoilerRoleProfile,
    );

    await patchBookCharacter(accessToken, bookId, characterId, {
      personalImpression: "Only the impression changed",
    });

    const res = await readAsEditPage(accessToken, characterId, bookId);
    expect(roleTypesOf(rolesOf(res))).toEqual(["antagonist", "supporting"]);
    expect(res.body.appearances[0].personalImpression).toBe("Only the impression changed");
  });
});

describe("spoiler character aliases in the contextual read", () => {
  it("withholds a spoiler book alias and names aliases in the character hiddenFields rather than the appearance's", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await patchBookCharacter(accessToken, bookId, characterId, { aliases: spoilerBookAliases });

    const res = await authed(
      "get",
      contextualPath({ characterId, contextBookId: bookId }),
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    expect(aliasNamesOf(aliasesScopedTo(res, bookId))).toEqual(["BookMuad"]);
    expect(res.body.hiddenFields).toContain("aliases");
    expect(res.body.appearances[0].hiddenFields).not.toContain("aliases");
  });

  it("returns the spoiler alias with its spoiler flag and drops aliases from hiddenFields when aliases are revealed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(accessToken, bookId, { name: "Paul Atreides" });
    await patchBookCharacter(accessToken, bookId, characterId, { aliases: spoilerBookAliases });

    const res = await authed(
      "get",
      contextualPath({ characterId, contextBookId: bookId, revealFieldIds: ["aliases"] }),
      accessToken,
    );
    expect(res.status).toBe(HttpStatus.OK);
    const bookAliases = aliasesScopedTo(res, bookId);
    expect(aliasNamesOf(bookAliases)).toEqual(["BookLisan", "BookMuad"]);
    expect(bookAliases.find((alias) => alias.name === "BookLisan")?.isSpoiler).toBe(true);
    expect(res.body.hiddenFields).not.toContain("aliases");
  });

  it("keeps spoiler aliases alive in both scopes when the edit page saves the aliases it got back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(accessToken, bookId, {
      aliases: spoilerGlobalAliases,
      name: "Paul Atreides",
    });
    await patchBookCharacter(accessToken, bookId, characterId, { aliases: spoilerBookAliases });

    const beforeGlobalSave = await readAsEditPage(accessToken, characterId, bookId);
    expect(aliasNamesOf(aliasesScopedTo(beforeGlobalSave, null))).toEqual([
      "GlobalLisan",
      "GlobalUsul",
    ]);

    await patchCharacter(accessToken, characterId, {
      aliases: aliasesScopedTo(beforeGlobalSave, null).map((alias) => toAliasUpdate(alias)),
      neutralDescription: "Heir of House Atreides",
    });

    const afterGlobalSave = await readAsEditPage(accessToken, characterId, bookId);
    const globalAliases = aliasesScopedTo(afterGlobalSave, null);
    expect(aliasNamesOf(globalAliases)).toEqual(["GlobalLisan", "GlobalUsul"]);
    expect(globalAliases.find((alias) => alias.name === "GlobalLisan")?.isSpoiler).toBe(true);
    expect(afterGlobalSave.body.neutralDescription).toBe("Heir of House Atreides");

    await patchBookCharacter(accessToken, bookId, characterId, {
      aliases: aliasesScopedTo(afterGlobalSave, bookId).map((alias) => toAliasUpdate(alias)),
      personalImpression: "Carries the whole book",
    });

    const afterBookSave = await readAsEditPage(accessToken, characterId, bookId);
    const bookAliases = aliasesScopedTo(afterBookSave, bookId);
    expect(aliasNamesOf(bookAliases)).toEqual(["BookLisan", "BookMuad"]);
    expect(bookAliases.find((alias) => alias.name === "BookLisan")?.isSpoiler).toBe(true);
    expect(afterBookSave.body.appearances[0].personalImpression).toBe("Carries the whole book");
  });

  it("leaves the stored aliases of both scopes untouched when the update body omits aliases", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const characterId = await createInBook(accessToken, bookId, {
      aliases: spoilerGlobalAliases,
      name: "Paul Atreides",
    });
    await patchBookCharacter(accessToken, bookId, characterId, { aliases: spoilerBookAliases });

    await patchCharacter(accessToken, characterId, { neutralDescription: "Only the global text" });
    await patchBookCharacter(accessToken, bookId, characterId, {
      personalImpression: "Only the book text",
    });

    const res = await readAsEditPage(accessToken, characterId, bookId);
    expect(aliasNamesOf(aliasesScopedTo(res, null))).toEqual(["GlobalLisan", "GlobalUsul"]);
    expect(aliasNamesOf(aliasesScopedTo(res, bookId))).toEqual(["BookLisan", "BookMuad"]);
    expect(res.body.neutralDescription).toBe("Only the global text");
    expect(res.body.appearances[0].personalImpression).toBe("Only the book text");
  });
});
