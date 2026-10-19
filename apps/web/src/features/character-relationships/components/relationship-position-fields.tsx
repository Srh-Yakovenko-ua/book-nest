"use client";

import type { UseFormRegister } from "react-hook-form";

import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { RELATIONSHIP_FORM_LIMITS } from "../model/relationship-form-schema";

const POSITION_FIELDS = {
  ended: {
    audio: "bookState.endedAudio",
    chapter: "bookState.endedChapter",
    page: "bookState.endedPage",
  },
  introduced: {
    audio: "bookState.introducedAudio",
    chapter: "bookState.introducedChapter",
    page: "bookState.introducedPage",
  },
} as const;

const POSITION_ERROR_KEYS = {
  ended: { audio: "endedAudio", chapter: "endedChapter", page: "endedPage" },
  introduced: { audio: "introducedAudio", chapter: "introducedChapter", page: "introducedPage" },
} as const;

type RelationshipPositionEdge = keyof typeof POSITION_FIELDS;

type RelationshipPositionFieldsProps = {
  control: RelationshipFormControl;
  edge: RelationshipPositionEdge;
  errors: RelationshipFormErrors;
  register: UseFormRegister<RelationshipFormInput>;
};

export function RelationshipPositionFields({
  control,
  edge,
  errors,
  register,
}: RelationshipPositionFieldsProps) {
  const t = useTranslations("relationships.editor.positions");
  const fields = POSITION_FIELDS[edge];
  const errorKeys = POSITION_ERROR_KEYS[edge];
  const fieldErrors = {
    audio: errors.bookState?.[errorKeys.audio],
    chapter: errors.bookState?.[errorKeys.chapter],
    page: errors.bookState?.[errorKeys.page],
  };
  const ids = {
    audio: `relationship-${edge}-audio`,
    chapter: `relationship-${edge}-chapter`,
    page: `relationship-${edge}-page`,
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-sm font-medium text-foreground">{t(edge)}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={ids.chapter}>{t("chapter")}</Label>
          <Input
            aria-describedby={fieldErrors.chapter ? `${ids.chapter}-error` : undefined}
            aria-invalid={fieldErrors.chapter !== undefined}
            autoComplete="off"
            className="h-10"
            id={ids.chapter}
            maxLength={RELATIONSHIP_FORM_LIMITS.chapterMax}
            {...register(fields.chapter)}
          />
          <FieldError error={fieldErrors.chapter} id={`${ids.chapter}-error`} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={ids.page}>{t("page")}</Label>
          <Controller
            control={control}
            name={fields.page}
            render={({ field }) => (
              <Input
                aria-describedby={fieldErrors.page ? `${ids.page}-error` : undefined}
                aria-invalid={fieldErrors.page !== undefined}
                autoComplete="off"
                className="h-10"
                id={ids.page}
                inputMode="numeric"
                min={1}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(event.target.value === "" ? null : Number(event.target.value))
                }
                onKeyDown={blockNegativeNumberKeys}
                onPaste={blockNegativeNumberPaste}
                ref={field.ref}
                step={1}
                type="number"
                value={field.value ?? ""}
              />
            )}
          />
          <FieldError error={fieldErrors.page} id={`${ids.page}-error`} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={ids.audio}>{t("audio")}</Label>
          <Input
            aria-describedby={fieldErrors.audio ? `${ids.audio}-error` : undefined}
            aria-invalid={fieldErrors.audio !== undefined}
            autoComplete="off"
            className="h-10"
            id={ids.audio}
            inputMode="numeric"
            placeholder={t("audioPlaceholder")}
            {...register(fields.audio)}
          />
          <FieldError error={fieldErrors.audio} id={`${ids.audio}-error`} />
        </div>
      </div>
    </fieldset>
  );
}
