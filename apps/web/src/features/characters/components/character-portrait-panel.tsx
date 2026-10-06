"use client";

import type { Nullable } from "@app/shared";
import type { Control } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";

import type { CharacterEditValues } from "../model/character-edit-form";
import type { CharacterImageUpload } from "./character-image-field";

import { effectiveCharacterName } from "../model/character-edit-form";
import { isBookFieldMasked } from "../model/character-inheritance";
import { CharacterImageField } from "./character-image-field";
import { CharacterSpoilerField } from "./character-spoiler-field";

type CharacterPortraitPanelProps = {
  control: Control<CharacterEditValues>;
  maskedFields: readonly string[];
  onPortraitUpload: (upload: CharacterImageUpload) => void;
  portraitUrl: Nullable<string>;
};

export function CharacterPortraitPanel({
  control,
  maskedFields,
  onPortraitUpload,
  portraitUrl,
}: CharacterPortraitPanelProps) {
  const t = useTranslations("characters.edit");
  const tInheritance = useTranslations("characters.inheritance");
  const titleId = useId();
  const globalName = useWatch({ control, name: "global.name" });
  const displayName = useWatch({ control, name: "book.displayName" });
  const name = effectiveCharacterName({ displayName, globalName });

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card md:p-6"
    >
      <div className="flex items-center gap-2.5">
        <UiIcon className="text-primary" name="image" size={20} />
        <h2 className="font-heading text-lg text-ink" id={titleId}>
          {t("portrait")}
        </h2>
      </div>

      {isBookFieldMasked(maskedFields, "portrait") ? (
        <CharacterSpoilerField hidden label={tInheritance("bookOnly")}>
          {null}
        </CharacterSpoilerField>
      ) : (
        <Controller
          control={control}
          name="book.portraitMediaId"
          render={({ field }) => {
            const isInherited = field.value === null;

            return (
              <div className="flex flex-col gap-4">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UiIcon name={isInherited ? "link" : "edit"} size={14} />
                  {isInherited ? t("portraitInherited") : tInheritance("bookOnly")}
                </p>
                <CharacterImageField
                  alt={name}
                  fallbackText={name}
                  onReset={() => field.onChange(null)}
                  onUpload={(upload) => {
                    field.onChange(upload.mediaId);
                    onPortraitUpload(upload);
                  }}
                  previewUrl={portraitUrl}
                  removeLabel={tInheritance("resetImage")}
                  uploadLabel={
                    isInherited ? tInheritance("specifyImageForBook") : tInheritance("replaceImage")
                  }
                  value={field.value}
                />
              </div>
            );
          }}
        />
      )}
    </section>
  );
}
