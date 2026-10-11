"use client";

import type { Nullable, SpeciesOptionView } from "@app/shared";

import { SPECIES_SEARCH } from "@app/shared";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { SpeciesGroup } from "./species-groups";

import { useCreateSpecies } from "../api/use-create-species";
import { useSpeciesCandidates } from "../api/use-species-candidates";
import { useSpeciesSearch } from "../api/use-species-search";
import { toSpeciesFailure } from "./species-failure";
import { groupSpeciesOptions } from "./species-groups";
import { speciesSearchTerm } from "./species-search-term";

export type SpeciesCreateOffer = {
  name: string;
  secondary: boolean;
};

export type SpeciesPickerNotice =
  "conflict" | "createFailed" | "empty" | "loadFailed" | "loading" | "tooShort";

export type SpeciesPickerSection =
  | { group: SpeciesGroup; kind: "group" }
  | { kind: "exact" | "similar"; options: SpeciesOptionView[] };

type SpeciesPickerModelArgs = {
  excludeId: string | undefined;
  open: boolean;
  typed: string;
};

export function useSpeciesPickerModel({ excludeId, open, typed }: SpeciesPickerModelArgs) {
  const currentTerm = speciesSearchTerm(typed);
  const debouncedTerm = speciesSearchTerm(useDebouncedValue(typed, SPECIES_SEARCH.debounceMs));
  const term = currentTerm === "" ? "" : debouncedTerm;
  const isSettled = term === currentTerm;

  const search = useSpeciesSearch({ enabled: open, term });
  const candidates = useSpeciesCandidates({ enabled: open, name: term });
  const createSpecies = useCreateSpecies();

  const isVisible = (option: SpeciesOptionView) => option.id !== excludeId;
  const failure =
    createSpecies.isError && createSpecies.variables.name === currentTerm
      ? toSpeciesFailure(createSpecies.error)
      : null;
  const conflictHolder = failure?.kind === "duplicate" ? failure.holder : null;

  const exact = term === "" ? null : (conflictHolder ?? candidates.data?.exact ?? null);
  const exactOptions = exact !== null && isVisible(exact) ? [exact] : [];
  const similarOptions =
    term === "" || exact !== null ? [] : (candidates.data?.similar ?? []).filter(isVisible);
  const pinnedIds = new Set([...exactOptions, ...similarOptions].map((option) => option.id));
  const results = (search.data ?? [])
    .filter(isVisible)
    .filter((option) => !pinnedIds.has(option.id));

  const sections: SpeciesPickerSection[] =
    !isSettled || search.isPending
      ? []
      : [
          ...(exactOptions.length > 0 ? [{ kind: "exact" as const, options: exactOptions }] : []),
          ...(similarOptions.length > 0
            ? [{ kind: "similar" as const, options: similarOptions }]
            : []),
          ...groupSpeciesOptions(results).map((group) => ({ group, kind: "group" as const })),
        ];

  const candidatesKnown = candidates.isSuccess || candidates.isError;
  const create: Nullable<SpeciesCreateOffer> =
    term !== "" && isSettled && candidatesKnown && exact === null && failure?.kind !== "duplicate"
      ? { name: term, secondary: similarOptions.length > 0 }
      : null;

  return {
    create,
    createSpecies,
    notice: pickerNotice({
      failureKind: failure?.kind ?? null,
      hasOptions: sections.length > 0,
      isLoading: !isSettled || search.isPending,
      loadFailed: search.isError,
      typed,
    }),
    retry: () => void search.refetch(),
    sections,
  };
}

function pickerNotice({
  failureKind,
  hasOptions,
  isLoading,
  loadFailed,
  typed,
}: {
  failureKind: Nullable<string>;
  hasOptions: boolean;
  isLoading: boolean;
  loadFailed: boolean;
  typed: string;
}): Nullable<SpeciesPickerNotice> {
  if (isLoading) return "loading";
  if (loadFailed) return "loadFailed";
  if (failureKind === "duplicate") return "conflict";
  if (failureKind !== null) return "createFailed";
  const typedLength = typed.trim().length;
  if (typedLength > 0 && typedLength < SPECIES_SEARCH.minQueryLength) return "tooShort";
  if (!hasOptions) return "empty";
  return null;
}
