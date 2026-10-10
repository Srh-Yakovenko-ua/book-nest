import type { Prisma } from "../../../generated/prisma/client.js";

export const SPECIES_REF_ARGS = {
  select: {
    id: true,
    key: true,
    name: true,
    names: {
      select: { kind: true, locale: true, name: true },
      where: { kind: "label" },
    },
  },
} satisfies Prisma.SpeciesDefaultArgs;

export const PORTABLE_SPECIES_ARGS = {
  select: { key: true, name: true },
} satisfies Prisma.SpeciesDefaultArgs;
