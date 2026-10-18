"use client";

import type {
  BookCharacterView,
  CharacterAliasView,
  CharacterDetailsView,
  CharacterRevealFieldKey,
  Nullable,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  type CharacterRevealControl,
  isFieldHidden,
  REVEAL_FOCUS_TARGET,
  revealFocusTarget,
} from "../model/character-spoiler";
import { CharacterHiddenGroupNotice } from "./character-hidden-group-notice";
import { CharacterOverviewCard } from "./character-overview-card";

type AliasField = Extract<CharacterRevealFieldKey, "bookAliases" | "globalAliases">;

type AliasGroupData = {
  aliases: CharacterAliasView[];
  hidden: boolean;
};

type CharacterAliasCardProps = {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  reveal: CharacterRevealControl;
};

export function CharacterAliasCard({ appearance, character, reveal }: CharacterAliasCardProps) {
  const t = useTranslations("characters.page");
  const tAliases = useTranslations("characters.aliases");
  const globalGroup = globalAliasGroupOf(character);
  const bookGroup = bookAliasGroupOf({ appearance, character });

  return (
    <CharacterOverviewCard
      groups={[
        isAliasGroupShown(globalGroup)
          ? {
              content: (
                <AliasGroup
                  field="globalAliases"
                  group={globalGroup}
                  reveal={reveal}
                  title={t("globalAliases")}
                />
              ),
              key: "global",
              title: t("globalAliases"),
            }
          : null,
        bookGroup !== null && isAliasGroupShown(bookGroup)
          ? {
              content: (
                <AliasGroup
                  field="bookAliases"
                  group={bookGroup}
                  reveal={reveal}
                  title={t("bookAliases")}
                />
              ),
              key: "book",
              title: t("bookAliases"),
            }
          : null,
      ]}
      icon="tag"
      title={tAliases("sectionTitle")}
    />
  );
}

export function hasAliases({
  appearance,
  character,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
}): boolean {
  const bookGroup = bookAliasGroupOf({ appearance, character });
  return (
    isAliasGroupShown(globalAliasGroupOf(character)) ||
    (bookGroup !== null && isAliasGroupShown(bookGroup))
  );
}

function AliasChip({ alias }: { alias: CharacterAliasView }) {
  const tType = useTranslations("characters.aliasType");
  const [open, setOpen] = useState(false);

  return (
    <li className="max-w-full sm:max-w-60">
      <Tooltip onOpenChange={setOpen} open={open}>
        <TooltipTrigger asChild>
          <button
            className="flex max-w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-left transition-colors outline-none hover:border-accent-border focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={(event) => {
              event.preventDefault();
              setOpen((value) => !value);
            }}
            type="button"
          >
            <span className="max-w-full truncate text-sm font-medium text-foreground">
              {alias.name}
            </span>
            <span className="text-xs text-muted-foreground">{tType(alias.type)}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{alias.name}</TooltipContent>
      </Tooltip>
    </li>
  );
}

function AliasGroup({
  field,
  group,
  reveal,
  title,
}: {
  field: AliasField;
  group: AliasGroupData;
  reveal: CharacterRevealControl;
  title: string;
}) {
  const t = useTranslations("characters.page");

  return (
    <div
      aria-label={title}
      className={cn("flex flex-col gap-3 rounded-lg", REVEAL_FOCUS_TARGET.focusClassName)}
      role="group"
      {...revealFocusTarget(field)}
    >
      {group.aliases.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2">
          {group.aliases.map((alias) => (
            <AliasChip alias={alias} key={alias.id} />
          ))}
        </ul>
      )}
      {group.hidden ? (
        <CharacterHiddenGroupNotice
          accessibleName={t("revealHiddenAliasesAria", { group: title })}
          actionLabel={t("revealHiddenAliases")}
          message={t("hiddenAliasesNotice")}
          onReveal={() => void reveal.onReveal(field)}
          revealing={reveal.pending === field}
        />
      ) : null}
    </div>
  );
}

function bookAliasGroupOf({
  appearance,
  character,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
}): Nullable<AliasGroupData> {
  if (appearance === undefined) return null;
  return {
    aliases: character.aliases.filter((alias) => alias.bookId === appearance.bookId),
    hidden: isFieldHidden(character.hiddenFields, "bookAliases"),
  };
}

function globalAliasGroupOf(character: CharacterDetailsView): AliasGroupData {
  return {
    aliases: character.aliases.filter((alias) => alias.bookId === null),
    hidden: isFieldHidden(character.hiddenFields, "globalAliases"),
  };
}

function isAliasGroupShown(group: AliasGroupData): boolean {
  return group.aliases.length > 0 || group.hidden;
}
