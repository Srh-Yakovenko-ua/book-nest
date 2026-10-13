"use client";

import type { Nullable, ValueOf } from "@app/shared";
import type { Control } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Controller, useController, useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

import type { CharacterEditValues } from "../model/character-edit-form";
import type { CharacterImageUpload } from "./character-image-field";

import { effectiveCharacterName } from "../model/character-edit-form";
import { isBookFieldMasked } from "../model/character-inheritance";
import { CharacterImageField } from "./character-image-field";
import { CharacterSpoilerField } from "./character-spoiler-field";

const BOOK_IMAGE_SOURCE = {
  book: "book",
  main: "main",
} as const;

type BookImageSource = ValueOf<typeof BOOK_IMAGE_SOURCE>;

type CharacterPortraitPanelProps = {
  avatarUrl: Nullable<string>;
  control: Control<CharacterEditValues>;
  hasBookScope: boolean;
  maskedFields: readonly string[];
  onImageUpload: (upload: CharacterImageUpload) => void;
  portraitUrl: Nullable<string>;
};

export function CharacterPortraitPanel({
  avatarUrl,
  control,
  hasBookScope,
  maskedFields,
  onImageUpload,
  portraitUrl,
}: CharacterPortraitPanelProps) {
  const t = useTranslations("characters.edit");
  const tInheritance = useTranslations("characters.inheritance");
  const titleId = useId();
  const avatarTitleId = useId();
  const bookTitleId = useId();
  const globalName = useWatch({ control, name: "global.name" });
  const avatarMediaId = useWatch({ control, name: "global.avatarMediaId" });

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card md:p-6"
    >
      <div className="flex items-center gap-2.5">
        <UiIcon className="text-primary" name="image" size={20} />
        <h2 className="font-heading text-lg text-ink" id={titleId}>
          {t("imagesTitle")}
        </h2>
      </div>

      <div aria-labelledby={avatarTitleId} className="flex flex-col gap-3" role="group">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-ink" id={avatarTitleId}>
            {t("mainAvatar")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("mainAvatarHint")}</p>
        </div>
        <Controller
          control={control}
          name="global.avatarMediaId"
          render={({ field }) => (
            <CharacterImageField
              alt={globalName}
              fallbackText={globalName}
              onUpload={(upload) => {
                onImageUpload(upload);
                field.onChange(upload.mediaId);
              }}
              previewUrl={avatarUrl}
              reset={
                field.value === null
                  ? undefined
                  : {
                      label: t("imageRemove"),
                      onReset: () => field.onChange(null),
                      tooltip: t("mainAvatarRemoveHint"),
                    }
              }
              uploadLabel={field.value === null ? t("imageAdd") : t("imageReplace")}
              variant="compact"
            />
          )}
        />
      </div>

      {hasBookScope ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink" id={bookTitleId}>
              {t("portrait")}
            </h3>
            {isBookFieldMasked(maskedFields, "portrait") ? (
              <CharacterSpoilerField hidden label={tInheritance("bookOnly")}>
                {null}
              </CharacterSpoilerField>
            ) : (
              <BookImageSourceField
                control={control}
                hasMainAvatar={avatarMediaId !== null}
                labelledBy={bookTitleId}
                onImageUpload={onImageUpload}
                portraitUrl={portraitUrl}
              />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function BookImageSourceField({
  control,
  hasMainAvatar,
  labelledBy,
  onImageUpload,
  portraitUrl,
}: {
  control: Control<CharacterEditValues>;
  hasMainAvatar: boolean;
  labelledBy: string;
  onImageUpload: (upload: CharacterImageUpload) => void;
  portraitUrl: Nullable<string>;
}) {
  const t = useTranslations("characters.edit");
  const idPrefix = useId();
  const globalName = useWatch({ control, name: "global.name" });
  const displayName = useWatch({ control, name: "book.displayName" });
  const name = effectiveCharacterName({ displayName, globalName });
  const { field } = useController({ control, name: "book.portraitMediaId" });
  const [source, setSource] = useState<BookImageSource>(
    field.value === null ? BOOK_IMAGE_SOURCE.main : BOOK_IMAGE_SOURCE.book,
  );
  const [stashedPortraitId, setStashedPortraitId] = useState<Nullable<string>>(null);

  const options = [
    { label: t("portraitUseMain"), value: BOOK_IMAGE_SOURCE.main },
    { label: t("portraitUseBook"), value: BOOK_IMAGE_SOURCE.book },
  ];
  const activeHintId = `${idPrefix}-hint`;
  const activeHint = activeSourceHint();

  function activeSourceHint(): string {
    if (source === BOOK_IMAGE_SOURCE.book) return t("portraitBookOnlyHint");
    return hasMainAvatar ? t("mainAvatarInUse") : t("mainAvatarMissing");
  }

  function chooseSource(next: BookImageSource) {
    setSource(next);
    if (next === BOOK_IMAGE_SOURCE.main) {
      setStashedPortraitId(field.value);
      field.onChange(null);
      return;
    }
    field.onChange(stashedPortraitId);
  }

  return (
    <>
      <RadioGroup
        aria-labelledby={labelledBy}
        className="gap-3"
        onValueChange={(value) => {
          if (isBookImageSource(value)) chooseSource(value);
        }}
        value={source}
      >
        {options.map((option) => (
          <div className="flex items-start gap-2.5" key={option.value}>
            <RadioGroupItem
              aria-describedby={option.value === source ? activeHintId : undefined}
              className="mt-0.5"
              id={`${idPrefix}-${option.value}`}
              value={option.value}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <Label
                className="cursor-pointer leading-snug font-normal"
                htmlFor={`${idPrefix}-${option.value}`}
                id={`${idPrefix}-${option.value}-label`}
              >
                {option.label}
              </Label>
              {option.value === source ? (
                <p className="text-xs text-muted-foreground" id={activeHintId}>
                  {activeHint}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </RadioGroup>

      {source === BOOK_IMAGE_SOURCE.book ? (
        <div
          aria-labelledby={`${idPrefix}-${BOOK_IMAGE_SOURCE.book}-label`}
          className="pl-6.5"
          role="group"
        >
          <CharacterImageField
            alt={name}
            fallbackText={name}
            onUpload={(upload) => {
              onImageUpload(upload);
              field.onChange(upload.mediaId);
            }}
            previewUrl={portraitUrl}
            uploadLabel={field.value === null ? t("imageAdd") : t("imageReplace")}
            variant="compact"
          />
        </div>
      ) : null}
    </>
  );
}

function isBookImageSource(value: string): value is BookImageSource {
  return Object.values<string>(BOOK_IMAGE_SOURCE).includes(value);
}
