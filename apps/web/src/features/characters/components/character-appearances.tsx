"use client";

import type { BookCharacterView, Nullable } from "@app/shared";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FormSection } from "@/features/books";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { appearanceListWindow } from "../model/character-appearances";
import { explicitImportance } from "../model/character-options";
import { getCharacterDetailsPath } from "../model/character-routes";

export type AppearanceListState = {
  expanded: boolean;
  mobileOpen: boolean;
};

type CharacterAppearancesProps = {
  activeBookId: Nullable<string>;
  appearances: BookCharacterView[];
  characterId: string;
  listState: AppearanceListState;
  onListStateChange: (next: AppearanceListState) => void;
};

export function CharacterAppearancesMobile(props: CharacterAppearancesProps) {
  const t = useTranslations("characters.page");
  const { appearances, listState, onListStateChange } = props;
  const [onlyAppearance, ...otherAppearances] = appearances;

  if (onlyAppearance === undefined) return null;

  if (otherAppearances.length === 0) {
    return (
      <section aria-label={t("appearancesSection")} className="lg:hidden">
        <ul>
          <AppearanceRow
            appearance={onlyAppearance}
            characterId={props.characterId}
            isActive={onlyAppearance.bookId === props.activeBookId}
          />
        </ul>
      </section>
    );
  }

  return (
    <Collapsible
      className="rounded-xl border border-border bg-card text-card-foreground shadow-detail-block lg:hidden"
      onOpenChange={(mobileOpen) => onListStateChange({ ...listState, mobileOpen })}
      open={listState.mobileOpen}
    >
      <h2>
        <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="font-heading text-base font-semibold text-ink">
              {t("appearancesSection")}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("appearancesCount", { count: appearances.length })}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="px-4 pb-4">
        <AppearanceList {...props} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CharacterAppearancesSidebar(props: CharacterAppearancesProps) {
  const t = useTranslations("characters.page");

  if (props.appearances.length === 0) return null;

  return (
    <aside className="hidden lg:flex lg:flex-col">
      <FormSection
        description={t("appearancesCount", { count: props.appearances.length })}
        icon="book"
        title={t("appearancesSection")}
      >
        <AppearanceList {...props} />
      </FormSection>
    </aside>
  );
}

function AppearanceList({
  activeBookId,
  appearances,
  characterId,
  listState,
  onListStateChange,
}: CharacterAppearancesProps) {
  const t = useTranslations("characters.page");
  const listId = useId();
  const { canToggle, pinned, rows } = appearanceListWindow({
    activeBookId,
    appearances,
    expanded: listState.expanded,
  });

  return (
    <div className="flex flex-col gap-3">
      {pinned === null ? null : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("pinnedContext")}
          </span>
          <ul>
            <AppearanceRow appearance={pinned} characterId={characterId} isActive />
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-2" id={listId}>
        {rows.map((appearance) => (
          <AppearanceRow
            appearance={appearance}
            characterId={characterId}
            isActive={appearance.bookId === activeBookId}
            key={appearance.bookId}
          />
        ))}
      </ul>
      {canToggle ? (
        <Button
          aria-controls={listId}
          aria-expanded={listState.expanded}
          className="self-start"
          onClick={() => onListStateChange({ ...listState, expanded: !listState.expanded })}
          size="sm"
          variant="ghost"
        >
          {listState.expanded
            ? t("collapse")
            : t("showAllAppearances", { count: appearances.length })}
        </Button>
      ) : null}
    </div>
  );
}

function AppearanceRow({
  appearance,
  characterId,
  isActive,
}: {
  appearance: BookCharacterView;
  characterId: string;
  isActive: boolean;
}) {
  const t = useTranslations("characters.page");
  const tImportance = useTranslations("characters.importance");
  const importance = explicitImportance(appearance.importance);
  const { book } = appearance;

  return (
    <li
      className={cn(
        "flex items-stretch gap-1 rounded-lg border transition-colors",
        isActive
          ? "border-accent-border bg-secondary/60"
          : "border-border hover:border-accent-border",
      )}
    >
      <TooltipHint label={book.title}>
        <Link
          aria-current={isActive ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={getCharacterDetailsPath({ bookId: book.id, characterId })}
          onClick={(event) => {
            if (isActive) event.preventDefault();
          }}
        >
          <span className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-sm bg-accent">
            {book.cover === null ? (
              <span className="grid size-full place-items-center text-accent-foreground/70">
                <UiIcon name="book" size={16} />
              </span>
            ) : (
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="40px"
                src={book.cover.urls.thumb}
                unoptimized
              />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-sm font-medium break-words text-foreground">
              {book.title}
            </span>
            {book.series === null ? null : (
              <span className="truncate text-xs text-muted-foreground">
                {book.series.partNumber === null
                  ? book.series.name
                  : t("seriesPart", { name: book.series.name, part: book.series.partNumber })}
              </span>
            )}
            {importance === null && !appearance.isPovCharacter && !isActive ? null : (
              <span className="flex flex-wrap items-center gap-1.5">
                {importance === null ? null : (
                  <Badge variant="secondary">{tImportance(importance)}</Badge>
                )}
                {appearance.isPovCharacter ? <Badge variant="info">{t("pov")}</Badge> : null}
                {isActive ? (
                  <span className="text-xs font-medium text-brand">{t("currentBook")}</span>
                ) : null}
              </span>
            )}
          </span>
        </Link>
      </TooltipHint>

      <TooltipHint label={t("openBook", { title: book.title })}>
        <Link
          aria-label={t("openBook", { title: book.title })}
          className="grid w-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/books/${book.id}`}
        >
          <UiIcon name="external" size={16} />
        </Link>
      </TooltipHint>
    </li>
  );
}
