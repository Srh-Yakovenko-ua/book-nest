"use client";

import type { CharacterGlobalSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type DuplicateCharacterSuggestionProps = {
  candidates: CharacterGlobalSummaryView[];
  onCreateAnyway: () => void;
  onUse: (characterId: string) => void;
};

export function DuplicateCharacterSuggestion({
  candidates,
  onCreateAnyway,
  onUse,
}: DuplicateCharacterSuggestionProps) {
  const t = useTranslations("characters.duplicate");

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-warning-soft/40 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <UiIcon className="text-warning" name="alert-circle" size={16} />
        {t("question")}
      </p>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li className="flex items-center gap-3" key={candidate.id}>
            <Avatar className="size-9" size="sm">
              {candidate.avatar === null ? null : (
                <AvatarImage alt={candidate.name} src={candidate.avatar.urls.thumb} />
              )}
              <AvatarFallback>{candidate.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {candidate.name}
            </span>
            <Button onClick={() => onUse(candidate.id)} size="sm" type="button" variant="secondary">
              {t("use")}
            </Button>
          </li>
        ))}
      </ul>

      <Button
        className="self-start"
        onClick={onCreateAnyway}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t("createAnyway")}
      </Button>
    </div>
  );
}
