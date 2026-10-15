"use client";

import type { CharacterAliasView, CharacterRevealFieldKey } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormSection } from "@/features/books";
import { cn } from "@/lib/utils";

import {
  type CharacterRevealControl,
  REVEAL_FOCUS_TARGET,
  revealFocusTarget,
} from "../model/character-spoiler";
import { CharacterHiddenGroupNotice } from "./character-hidden-group-notice";

type CharacterAliasCardProps = {
  aliases: CharacterAliasView[];
  field: Extract<CharacterRevealFieldKey, "bookAliases" | "globalAliases">;
  hidden: boolean;
  reveal: CharacterRevealControl;
  title: string;
};

export function CharacterAliasCard({
  aliases,
  field,
  hidden,
  reveal,
  title,
}: CharacterAliasCardProps) {
  const t = useTranslations("characters.page");

  if (aliases.length === 0 && !hidden) return null;

  return (
    <FormSection icon="tag" title={title}>
      <div
        aria-label={title}
        className={cn("flex flex-col gap-3 rounded-lg", REVEAL_FOCUS_TARGET.focusClassName)}
        role="group"
        {...revealFocusTarget(field)}
      >
        {aliases.length === 0 ? null : (
          <ul className="flex flex-wrap gap-2">
            {aliases.map((alias) => (
              <AliasChip alias={alias} key={alias.id} />
            ))}
          </ul>
        )}
        {hidden ? (
          <CharacterHiddenGroupNotice
            accessibleName={t("revealHiddenAliasesAria", { group: title })}
            actionLabel={t("revealHiddenAliases")}
            message={t("hiddenAliasesNotice")}
            onReveal={() => void reveal.onReveal(field)}
            revealing={reveal.pending === field}
          />
        ) : null}
      </div>
    </FormSection>
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
