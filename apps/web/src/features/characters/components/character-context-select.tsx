"use client";

import type { BookCharacterView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

import type { CharacterDetailsMode } from "../model/character-details-context";

import { CHARACTER_GLOBAL_VIEW, getCharacterDetailsPath } from "../model/character-routes";

type CharacterContextSelectProps = {
  appearances: BookCharacterView[];
  characterId: string;
  mode: CharacterDetailsMode;
};

export function CharacterContextSelect({
  appearances,
  characterId,
  mode,
}: CharacterContextSelectProps) {
  const t = useTranslations("characters.page");
  const router = useRouter();
  const labelId = useId();

  if (appearances.length === 0) return null;

  const value = mode.kind === "book" ? mode.bookId : CHARACTER_GLOBAL_VIEW;

  function selectContext(next: string) {
    if (next === value) return;
    router.push(
      next === CHARACTER_GLOBAL_VIEW
        ? getCharacterDetailsPath({ characterId, view: CHARACTER_GLOBAL_VIEW })
        : getCharacterDetailsPath({ bookId: next, characterId }),
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-sm font-medium text-muted-foreground" id={labelId}>
        {t("contextLabel")}
      </span>
      <Select onValueChange={selectContext} value={value}>
        <SelectTrigger
          aria-labelledby={labelId}
          className="w-full min-w-0 data-[size=default]:h-10 sm:max-w-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CHARACTER_GLOBAL_VIEW}>{t("globalProfile")}</SelectItem>
          {appearances.map((appearance) => (
            <SelectItem key={appearance.bookId} value={appearance.bookId}>
              {appearance.book.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
