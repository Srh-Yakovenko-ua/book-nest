"use client";

import type { Nullable } from "@app/shared";
import type { Control } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { CharacterCard } from "@/components/ui/character-card";

import type { CharacterEditValues } from "../model/character-edit-form";

import { effectiveCharacterName } from "../model/character-edit-form";
import {
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_STATUS,
  explicitImportance,
  explicitStatus,
} from "../model/character-options";

type CharacterEditPreviewProps = {
  control: Control<CharacterEditValues>;
  imageUrl: Nullable<string>;
};

export function CharacterEditPreview({ control, imageUrl }: CharacterEditPreviewProps) {
  const t = useTranslations("characters.edit");
  const tCard = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const titleId = useId();

  const globalName = useWatch({ control, name: "global.name" });
  const displayName = useWatch({ control, name: "book.displayName" });
  const importance = explicitImportance(useWatch({ control, name: "book.importance" }));
  const status = explicitStatus(useWatch({ control, name: "book.status" }));
  const statusCustomText = useWatch({ control, name: "book.statusCustomText" });
  const isPovCharacter = useWatch({ control, name: "book.isPovCharacter" });

  const name = effectiveCharacterName({ displayName, globalName });
  const statusTrait = describeStatus();
  const traits = [
    ...(isPovCharacter ? [tCard("pov")] : []),
    ...(statusTrait === null ? [] : [statusTrait]),
  ];

  function describeStatus(): Nullable<string> {
    if (status === null) return null;
    const customStatus = statusCustomText.trim();
    if (status === BOOK_CHARACTER_STATUS.custom && customStatus.length > 0) return customStatus;
    return tStatus(status);
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <UiIcon className="text-primary" name="sparkles" size={20} />
        <h2 className="font-heading text-lg text-ink" id={titleId}>
          {t("previewTitle")}
        </h2>
      </div>

      <CharacterCard
        avatar={imageUrl === null ? undefined : { alt: name, src: imageUrl }}
        className="hover:translate-y-0 hover:shadow-card"
        name={name}
        role={
          importance === null
            ? undefined
            : {
                label: tImportance(importance),
                variant: BOOK_CHARACTER_IMPORTANCE.badgeVariant[importance],
              }
        }
        traits={traits.length === 0 ? undefined : traits}
      />
    </section>
  );
}
