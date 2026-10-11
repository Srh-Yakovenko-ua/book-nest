import type { CatalogLocale, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { z } from "zod";

import type { PrismaService } from "../../../core/database/prisma.service.js";

const SpeciesReferenceRowSchema = z.object({
  legacy: z.string().nullable(),
  speciesId: z.string().nullable(),
});

const OverrideReferenceRowSchema = SpeciesReferenceRowSchema.extend({
  isSpoiler: z.boolean(),
});

export type OverrideReference = z.infer<typeof OverrideReferenceRowSchema>;

export type SpeciesApi = ReturnType<typeof speciesApi>;

export type SpeciesReference = z.infer<typeof SpeciesReferenceRowSchema>;

type SeedCharacterInput = {
  deletedAt?: Date;
  legacySpecies?: Nullable<string>;
  name: string;
  prisma: PrismaService;
  speciesId?: Nullable<string>;
  userId: string;
};

type SeedOverrideInput = {
  characterId: string;
  legacySpeciesOverride?: Nullable<string>;
  prisma: PrismaService;
  speciesOverrideId: Nullable<string>;
  speciesOverrideIsSpoiler: boolean;
  userId: string;
};

export const SPECIES_TEST_IDS = {
  missing: "00000000-0000-4000-8000-000000000000",
} as const;

export async function readCharacterSpecies({
  characterId,
  prisma,
}: {
  characterId: string;
  prisma: PrismaService;
}): Promise<SpeciesReference> {
  const rows = await prisma.$queryRaw`
    SELECT species_id::text AS "speciesId", species AS "legacy"
    FROM characters
    WHERE id = ${characterId}::uuid
  `;
  return z.tuple([SpeciesReferenceRowSchema]).parse(rows)[0];
}

export async function readOverrideSpecies({
  bookCharacterId,
  prisma,
}: {
  bookCharacterId: string;
  prisma: PrismaService;
}): Promise<OverrideReference> {
  const rows = await prisma.$queryRaw`
    SELECT species_override_id::text AS "speciesId",
           species_override AS "legacy",
           species_override_is_spoiler AS "isSpoiler"
    FROM book_characters
    WHERE id = ${bookCharacterId}::uuid
  `;
  return z.tuple([OverrideReferenceRowSchema]).parse(rows)[0];
}

export async function seedCharacter({
  deletedAt,
  legacySpecies = null,
  name,
  prisma,
  speciesId = null,
  userId,
}: SeedCharacterInput): Promise<{ id: string }> {
  const character = await prisma.character.create({
    data: {
      deletedAt,
      name,
      normalizedName: name.toLowerCase(),
      purgeAt: deletedAt,
      speciesId,
      userId,
    },
    select: { id: true },
  });
  await prisma.$executeRaw`
    UPDATE characters SET species = ${legacySpecies} WHERE id = ${character.id}::uuid
  `;
  return character;
}

export async function seedOverride({
  characterId,
  legacySpeciesOverride = null,
  prisma,
  speciesOverrideId,
  speciesOverrideIsSpoiler,
  userId,
}: SeedOverrideInput): Promise<{ id: string }> {
  const book = await prisma.book.create({
    data: { title: "Override probe", userId },
    select: { id: true },
  });
  const bookCharacter = await prisma.bookCharacter.create({
    data: { bookId: book.id, characterId, speciesOverrideId, speciesOverrideIsSpoiler },
    select: { id: true },
  });
  await prisma.$executeRaw`
    UPDATE book_characters
    SET species_override = ${legacySpeciesOverride}
    WHERE id = ${bookCharacter.id}::uuid
  `;
  return bookCharacter;
}

export function speciesApi({ accessToken, app }: { accessToken: string; app: INestApplication }) {
  const server = app.getHttpServer();
  const authorization = `Bearer ${accessToken}`;

  return {
    candidates: (name: string, locale: CatalogLocale = "uk") =>
      request(server)
        .get("/api/species/candidates")
        .query({ locale, name })
        .set("Authorization", authorization),
    create: (name: string, locale: CatalogLocale = "uk") =>
      request(server)
        .post("/api/species")
        .query({ locale })
        .set("Authorization", authorization)
        .send({ name }),
    deletionPreview: (speciesId: string) =>
      request(server)
        .get(`/api/species/${speciesId}/deletion-preview`)
        .set("Authorization", authorization),
    merge: (speciesId: string, targetId: string, locale: CatalogLocale = "uk") =>
      request(server)
        .post(`/api/species/${speciesId}/merge`)
        .query({ locale })
        .set("Authorization", authorization)
        .send({ targetId }),
    own: (locale: CatalogLocale = "uk") =>
      request(server).get("/api/species/own").query({ locale }).set("Authorization", authorization),
    remove: (speciesId: string) =>
      request(server).delete(`/api/species/${speciesId}`).set("Authorization", authorization),
    rename: (speciesId: string, name: string, locale: CatalogLocale = "uk") =>
      request(server)
        .patch(`/api/species/${speciesId}`)
        .query({ locale })
        .set("Authorization", authorization)
        .send({ name }),
    search: (query: { locale?: CatalogLocale; q?: string }) =>
      request(server).get("/api/species").query(query).set("Authorization", authorization),
  };
}
