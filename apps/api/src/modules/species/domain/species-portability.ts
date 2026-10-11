import type { Nullable } from "@app/shared";

import { collapseSpaces } from "@app/shared";

import { findExactSpeciesMatch } from "./species-name-matching.js";
import { normalizeSpeciesName } from "./species-name-normalizer.js";

export type ImportableSpeciesName = {
  name: string;
  normalizedName: string;
};

export type PortableSpeciesCandidate = {
  id: string;
  key: Nullable<string>;
  normalizedNames: readonly string[];
};

export type PortableSpeciesRef = {
  key: Nullable<string>;
  name: Nullable<string>;
};

export type PortableSpeciesResolver = (ref: PortableSpeciesRef) => Nullable<string>;

export type PortableSpeciesSource = {
  key: Nullable<string>;
  name: string;
};

const NO_PORTABLE_SPECIES: PortableSpeciesRef = { key: null, name: null };

export function hasPortableSpeciesIdentity(ref: PortableSpeciesRef): boolean {
  return ref.key !== null || normalizeSpeciesName(ref.name ?? "").length > 0;
}

export function importableSpeciesName(ref: PortableSpeciesRef): Nullable<ImportableSpeciesName> {
  const name = collapseSpaces(ref.name ?? "");
  const normalizedName = normalizeSpeciesName(name);
  return normalizedName.length === 0 ? null : { name, normalizedName };
}

export function matchPortableSpecies<Candidate extends PortableSpeciesCandidate>({
  candidates,
  ref,
}: {
  candidates: readonly Candidate[];
  ref: PortableSpeciesRef;
}): Nullable<Candidate> {
  const bySystemKey =
    ref.key === null ? undefined : candidates.find((candidate) => candidate.key === ref.key);
  if (bySystemKey !== undefined) {
    return bySystemKey;
  }
  const normalizedName = normalizeSpeciesName(ref.name ?? "");
  if (normalizedName.length === 0) {
    return null;
  }
  return findExactSpeciesMatch({ candidates, normalizedName });
}

export function portableSpeciesRefId(ref: PortableSpeciesRef): string {
  return JSON.stringify([ref.key, normalizeSpeciesName(ref.name ?? "")]);
}

export function toPortableSpeciesRef(species: Nullable<PortableSpeciesSource>): PortableSpeciesRef {
  if (species === null) {
    return NO_PORTABLE_SPECIES;
  }
  return { key: species.key, name: species.name };
}
