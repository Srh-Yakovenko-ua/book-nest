"use client";

import type { BookCharacterView, CharacterRevealFieldKey, Nullable } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { PageTabsItem } from "@/components/page-tabs";

import { UiIcon } from "@/components/icons";
import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";

import type { AppearanceListState } from "./character-appearances";

import { characterDetailsQueryOptions, useCharacterDetails } from "../api/use-character-details";
import { sortAppearances } from "../model/character-appearances";
import {
  canonicalCharacterDetailsHref,
  type CharacterDetailsMode,
  characterRouteArgsOf,
  isUnavailableContextError,
  resolveCharacterDetailsMode,
  resolveCharacterDetailsRequest,
} from "../model/character-details-context";
import { toCharacterDetailsTab } from "../model/character-details-query";
import {
  CHARACTER_DETAILS_TABS,
  CHARACTER_GLOBAL_VIEW,
  getBookCharactersPath,
  getCharacterDetailsPath,
  getCharacterEditPath,
} from "../model/character-routes";
import {
  addRevealKey,
  type CharacterRevealControl,
  findRevealFocusTarget,
  isFieldHidden,
} from "../model/character-spoiler";
import {
  useCharacterDetailsTab,
  useCharacterFactsSearch,
} from "../model/use-character-details-query";
import { CharacterAppearancesMobile, CharacterAppearancesSidebar } from "./character-appearances";
import { CharacterContextSelect } from "./character-context-select";
import { CharacterDetailsHero } from "./character-details-hero";
import { CharacterFactsTab } from "./character-facts-tab";
import { CharacterOverview } from "./character-overview";
import { CharacterUnavailableContext } from "./character-unavailable-context";
import { CharactersErrorState } from "./characters-error-state";

type CharacterDetailsPageProps = {
  characterId: string;
};

type ContextViewProps = {
  appearances: BookCharacterView[];
  characterId: string;
  listState: AppearanceListState;
  mode: CharacterDetailsMode;
  onListStateChange: (next: AppearanceListState) => void;
};

type RevealState = {
  confirmed: CharacterRevealFieldKey[];
  pending: Nullable<CharacterRevealFieldKey>;
};

const INITIAL_LIST_STATE: AppearanceListState = { expanded: false, mobileOpen: false };

export function CharacterDetailsPage({ characterId }: CharacterDetailsPageProps) {
  const router = useRouter();
  const [bookId] = useQueryState("bookId", parseAsString);
  const [view] = useQueryState("view", parseAsString);
  const [tab] = useCharacterDetailsTab();
  const [q] = useCharacterFactsSearch();
  const request = resolveCharacterDetailsRequest({ bookId, view });
  const canonicalHref = canonicalCharacterDetailsHref({
    characterId,
    search: { bookId, q, tab, view },
  });

  useEffect(() => {
    if (canonicalHref !== null) router.replace(canonicalHref);
  }, [canonicalHref, router]);

  if (request.kind === "invalid-book") {
    return <CharacterUnavailableContext characterId={characterId} />;
  }

  return <CharacterDetailsLoader characterId={characterId} key={characterId} request={request} />;
}

function CharacterDetailsContextView({
  appearances,
  characterId,
  listState,
  mode,
  onListStateChange,
}: ContextViewProps) {
  const t = useTranslations("characters.page");
  const tTabs = useTranslations("characters.facts.tabs");
  const tToast = useTranslations("characters.toast");
  const queryClient = useQueryClient();
  const [tab, setTab] = useCharacterDetailsTab();
  const articleRef = useRef<HTMLElement>(null);
  const contextSelectRef = useRef<HTMLButtonElement>(null);
  const [isContextSelectOpen, setContextSelectOpen] = useState(false);
  const focusRequest = useRef<Nullable<CharacterRevealFieldKey>>(null);
  const [revealState, setRevealState] = useState<RevealState>({ confirmed: [], pending: null });

  const contextBookId = mode.kind === "book" ? mode.bookId : undefined;
  const requestedKeys =
    revealState.pending === null
      ? revealState.confirmed
      : addRevealKey(revealState.confirmed, revealState.pending);
  const details = useCharacterDetails({
    characterId,
    contextBookId,
    revealFieldIds: revealState.confirmed,
  });
  useCharacterDetails({
    characterId,
    contextBookId,
    enabled: revealState.pending !== null,
    revealFieldIds: requestedKeys,
  });

  useEffect(() => {
    const requested = focusRequest.current;
    if (requested === null || revealState.pending !== null || details.data === undefined) return;
    focusRequest.current = null;
    if (isFieldHidden(details.data.hiddenFields, requested) || articleRef.current === null) return;
    findRevealFocusTarget(articleRef.current, requested)?.focus();
  }, [details.data, revealState.pending]);

  function openContextSelect() {
    contextSelectRef.current?.focus();
    setContextSelectOpen(true);
  }

  async function revealField(field: CharacterRevealFieldKey): Promise<boolean> {
    if (revealState.pending !== null || revealState.confirmed.includes(field)) return false;
    const target = addRevealKey(revealState.confirmed, field);
    focusRequest.current = field;
    setRevealState({ confirmed: revealState.confirmed, pending: field });
    try {
      await queryClient.fetchQuery(
        characterDetailsQueryOptions({ characterId, contextBookId, revealFieldIds: target }),
      );
      setRevealState({ confirmed: target, pending: null });
      return true;
    } catch {
      toast.error(tToast("revealError"));
      setRevealState((current) => ({ ...current, pending: null }));
      return false;
    }
  }

  if (details.isPending) return <DetailsSkeleton />;

  if (details.isError) {
    if (mode.kind === "book" && isUnavailableContextError(details.error)) {
      return <CharacterUnavailableContext characterId={characterId} />;
    }
    return <CharactersErrorState onRetry={() => void details.refetch()} />;
  }

  const character = details.data;
  const appearance =
    mode.kind === "book"
      ? character.appearances.find((entry) => entry.bookId === mode.bookId)
      : undefined;

  if (mode.kind === "book" && appearance === undefined) {
    return <CharacterUnavailableContext characterId={characterId} />;
  }

  const reveal: CharacterRevealControl = {
    isRevealed: (field) => revealState.confirmed.includes(field),
    onReveal: revealField,
    pending: revealState.pending,
  };
  const activeBookId = mode.kind === "book" ? mode.bookId : null;
  const editHref = getCharacterEditPath(characterRouteArgsOf({ characterId, mode }));
  const appearancesProps = {
    activeBookId,
    appearances,
    characterId,
    listState,
    onListStateChange,
  };
  const tabItems: PageTabsItem[] = CHARACTER_DETAILS_TABS.map((value) => ({
    label: tTabs(value),
    value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href={activeBookId === null ? "/my-library" : getBookCharactersPath(activeBookId)}
      >
        <UiIcon name="chevron-left" size={16} />
        {activeBookId === null ? t("backToLibrary") : t("backToBook")}
      </Link>

      <div className="grid gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <article className="flex min-w-0 flex-col gap-6" ref={articleRef}>
          <CharacterDetailsHero
            appearance={appearance}
            character={character}
            editHref={editHref}
            reveal={reveal}
          />
          <CharacterContextSelect
            appearances={appearances}
            characterId={characterId}
            mode={mode}
            onOpenChange={setContextSelectOpen}
            open={isContextSelectOpen}
            triggerRef={contextSelectRef}
          />
          <PageTabs
            items={tabItems}
            onValueChange={(value) => void setTab(toCharacterDetailsTab(value))}
            value={tab}
          >
            <PageTabsPanel className="flex flex-col gap-6" value="overview">
              <CharacterAppearancesMobile {...appearancesProps} />
              <CharacterOverview
                appearance={appearance}
                character={character}
                editHref={editHref}
                reveal={reveal}
              />
            </PageTabsPanel>
            <PageTabsPanel value="facts">
              <CharacterFactsTab
                characterId={characterId}
                mode={mode}
                onChooseBook={appearances.length === 0 ? null : openContextSelect}
              />
            </PageTabsPanel>
          </PageTabs>
        </article>

        <CharacterAppearancesSidebar {...appearancesProps} />
      </div>
    </div>
  );
}

function CharacterDetailsLoader({
  characterId,
  request,
}: {
  characterId: string;
  request: CharacterDetailsMode;
}) {
  const router = useRouter();
  const [tab] = useCharacterDetailsTab();
  const [q] = useCharacterFactsSearch();
  const [listState, setListState] = useState<AppearanceListState>(INITIAL_LIST_STATE);
  const base = useCharacterDetails({ characterId });

  const mode =
    base.data === undefined
      ? null
      : resolveCharacterDetailsMode({ appearances: base.data.appearances, request });
  const smartBookHref =
    request.kind === "smart" && mode?.kind === "book"
      ? getCharacterDetailsPath({ bookId: mode.bookId, characterId, q, tab })
      : null;

  useEffect(() => {
    if (smartBookHref !== null) router.replace(smartBookHref);
  }, [router, smartBookHref]);

  if (base.isPending) return <DetailsSkeleton />;

  if (base.isError) {
    return <CharactersErrorState onRetry={() => void base.refetch()} />;
  }

  if (mode === null) return <CharacterUnavailableContext characterId={characterId} />;

  return (
    <CharacterDetailsContextView
      appearances={sortAppearances(base.data.appearances)}
      characterId={characterId}
      key={mode.kind === "book" ? mode.bookId : CHARACTER_GLOBAL_VIEW}
      listState={listState}
      mode={mode}
      onListStateChange={setListState}
    />
  );
}

function DetailsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6" role="status">
      <Skeleton className="h-5 w-40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex gap-6 rounded-2xl border border-border p-5 md:p-7">
            <Skeleton className="aspect-[3/4] w-[6.5rem] rounded-xl sm:w-[180px]" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-72 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
