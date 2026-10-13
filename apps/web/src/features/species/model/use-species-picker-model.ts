"use client";

import type { Nullable, SpeciesOptionView } from "@app/shared";

import { SPECIES_SEARCH } from "@app/shared";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { SpeciesPickerSection } from "./species-picker-sections";

import { useCreateSpecies } from "../api/use-create-species";
import { useSpeciesBrowse } from "../api/use-species-browse";
import { useSpeciesCandidates } from "../api/use-species-candidates";
import { useSpeciesSearch } from "../api/use-species-search";
import { toSpeciesFailure } from "./species-failure";
import { browseSections, searchSections } from "./species-picker-sections";
import { speciesSearchTerm } from "./species-search-term";

export type SpeciesCreateOffer = {
  name: string;
  secondary: boolean;
};

export type SpeciesPickerMore = {
  load: () => void;
  status: SpeciesPickerMoreStatus;
};

export type SpeciesPickerNotice =
  "conflict" | "createFailed" | "empty" | "loadFailed" | "loading" | "tooShort";

type SpeciesPickerModelArgs = {
  allowCreate: boolean;
  excludeId: string | undefined;
  open: boolean;
  typed: string;
};

type SpeciesPickerMoreStatus = "available" | "complete" | "failed" | "loading" | "refreshing";

export function useSpeciesPickerModel({
  allowCreate,
  excludeId,
  open,
  typed,
}: SpeciesPickerModelArgs) {
  const currentTerm = speciesSearchTerm(typed);
  const debouncedTerm = speciesSearchTerm(useDebouncedValue(typed, SPECIES_SEARCH.debounceMs));
  const term = currentTerm === "" ? "" : debouncedTerm;
  const isSettled = term === currentTerm;
  const isBrowsing = term === "";

  const search = useSpeciesSearch({ enabled: open, term });
  const browse = useSpeciesBrowse({ enabled: open && isBrowsing });
  const candidates = useSpeciesCandidates({ enabled: open, name: term });
  const createSpecies = useCreateSpecies();

  const isVisible = (option: SpeciesOptionView) => option.id !== excludeId;
  const failure =
    createSpecies.isError && createSpecies.variables.name === currentTerm
      ? toSpeciesFailure(createSpecies.error)
      : null;
  const conflictHolder = failure?.kind === "duplicate" ? failure.holder : null;

  const exact = isBrowsing ? null : (conflictHolder ?? candidates.data?.exact ?? null);
  const exactOptions = exact !== null && isVisible(exact) ? [exact] : [];
  const similarOptions =
    isBrowsing || exact !== null ? [] : (candidates.data?.similar ?? []).filter(isVisible);
  const searchResults = (search.data ?? []).filter(isVisible);
  const catalog = (browse.data?.pages ?? []).flatMap((page) => page.items).filter(isVisible);

  const browseFailed = isBrowsing && browse.isError && !browse.isFetchNextPageError;
  const isLoading = !isSettled || search.isPending || (isBrowsing && browse.isPending);
  const loadedSections: SpeciesPickerSection[] = isBrowsing
    ? browseSections({ catalog, pinned: searchResults })
    : searchSections({ exact: exactOptions, results: searchResults, similar: similarOptions });
  const sections = isLoading ? [] : loadedSections;

  const moreStatus = browseMoreStatus({
    hasNextPage: browse.hasNextPage,
    isFetching: browse.isFetching,
    isFetchingNextPage: browse.isFetchingNextPage,
    isFetchNextPageError: browse.isFetchNextPageError,
    isShown: isBrowsing && sections.length > 0,
  });

  const candidatesKnown = candidates.isSuccess || candidates.isError;
  const create: Nullable<SpeciesCreateOffer> =
    allowCreate &&
    term !== "" &&
    isSettled &&
    candidatesKnown &&
    exact === null &&
    failure?.kind !== "duplicate"
      ? { name: term, secondary: similarOptions.length > 0 }
      : null;

  return {
    create,
    createSpecies,
    more: {
      load: () => {
        if (moreStatus === "available" || moreStatus === "failed") void browse.fetchNextPage();
      },
      status: moreStatus,
    } satisfies SpeciesPickerMore,
    notice: pickerNotice({
      failureKind: failure?.kind ?? null,
      hasOptions: sections.length > 0,
      isLoading,
      loadFailed: search.isError || browseFailed,
      typed,
    }),
    retry: () => {
      if (search.isError) void search.refetch();
      if (browseFailed) void browse.refetch();
    },
    sections,
  };
}

function browseMoreStatus({
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  isFetchNextPageError,
  isShown,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isShown: boolean;
}): SpeciesPickerMoreStatus {
  if (!isShown || !hasNextPage) return "complete";
  if (isFetchingNextPage) return "loading";
  if (isFetching) return "refreshing";
  if (isFetchNextPageError) return "failed";
  return "available";
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
