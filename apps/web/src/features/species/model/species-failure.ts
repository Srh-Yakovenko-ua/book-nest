import type { Nullable, SpeciesOptionView, SpeciesUsage } from "@app/shared";

import { SPECIES_ERROR_CODES, SpeciesOptionViewSchema, SpeciesUsageSchema } from "@app/shared";
import { z } from "zod";

import { ApiError } from "@/lib/http-client";

export type SpeciesFailure =
  | { holder: Nullable<SpeciesOptionView>; kind: "duplicate" }
  | { kind: "inUse"; usage: Nullable<SpeciesUsage> }
  | { kind: SimpleSpeciesFailureKind };

type SimpleSpeciesFailureKind =
  "forbidden" | "generic" | "mergeConflict" | "mergeInvalidTarget" | "mergeSelf" | "notFound";

const DuplicateDetailsSchema = z.object({ species: SpeciesOptionViewSchema });

const SIMPLE_FAILURE_BY_CODE = {
  [SPECIES_ERROR_CODES.forbidden]: "forbidden",
  [SPECIES_ERROR_CODES.mergeConflict]: "mergeConflict",
  [SPECIES_ERROR_CODES.mergeInvalidTarget]: "mergeInvalidTarget",
  [SPECIES_ERROR_CODES.mergeSelf]: "mergeSelf",
  [SPECIES_ERROR_CODES.notFound]: "notFound",
} as const satisfies Record<string, SimpleSpeciesFailureKind>;

export function toSpeciesFailure(error: unknown): SpeciesFailure {
  if (!(error instanceof ApiError)) return { kind: "generic" };

  if (error.code === SPECIES_ERROR_CODES.duplicate) {
    const details = DuplicateDetailsSchema.safeParse(error.details);
    return { holder: details.success ? details.data.species : null, kind: "duplicate" };
  }

  if (error.code === SPECIES_ERROR_CODES.inUse) {
    const usage = SpeciesUsageSchema.safeParse(error.details);
    return { kind: "inUse", usage: usage.success ? usage.data : null };
  }

  return { kind: simpleFailureKind(error.code) };
}

function simpleFailureKind(code: string | undefined): SimpleSpeciesFailureKind {
  const match = Object.entries(SIMPLE_FAILURE_BY_CODE).find(([errorCode]) => errorCode === code);
  return match === undefined ? "generic" : match[1];
}
