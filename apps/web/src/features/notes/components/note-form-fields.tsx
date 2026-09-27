"use client";

import { NOTE_INPUT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { NoteFormControl, NoteFormErrors, NoteFormRegister } from "../model/note-form-schema";

import { NOTE_CATEGORY_OPTIONS, NOTE_CUSTOM_CATEGORY } from "../model/note-categories";
import { NOTE_FORM_FIELD_IDS } from "./note-form-field-ids";

type NoteFieldsProps = {
  control: NoteFormControl;
  errors: NoteFormErrors;
  register: NoteFormRegister;
};

type NoteFlag = "isFavorite" | "isPinned" | "isSpoiler";

const NOTE_FLAG_FIELDS = [
  {
    help: "spoilerHelp",
    helpId: NOTE_FORM_FIELD_IDS.spoilerHelp,
    id: NOTE_FORM_FIELD_IDS.spoiler,
    label: "spoiler",
    name: "isSpoiler",
  },
  {
    help: "favoriteHelp",
    helpId: NOTE_FORM_FIELD_IDS.favoriteHelp,
    id: NOTE_FORM_FIELD_IDS.favorite,
    label: "favorite",
    name: "isFavorite",
  },
  {
    help: "pinnedHelp",
    helpId: NOTE_FORM_FIELD_IDS.pinnedHelp,
    id: NOTE_FORM_FIELD_IDS.pinned,
    label: "pinned",
    name: "isPinned",
  },
] as const satisfies readonly {
  help: string;
  helpId: string;
  id: string;
  label: string;
  name: NoteFlag;
}[];

export function NoteCategoryFields({ control, errors, register }: NoteFieldsProps) {
  const t = useTranslations("notes.form");
  const tCategories = useTranslations("notes.categories");
  const category = useWatch({ control, name: "category" });

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label className="flex-wrap" htmlFor={NOTE_FORM_FIELD_IDS.category}>
          {t("category")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <SelectTrigger
                className="h-10 w-full data-[size=default]:h-10"
                clearLabel={t("categoryClear")}
                id={NOTE_FORM_FIELD_IDS.category}
                isClearable={field.value !== undefined}
                onClear={() => field.onChange(undefined)}
              >
                <SelectValue placeholder={t("categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tCategories(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {category === NOTE_CUSTOM_CATEGORY ? (
        <div className="flex flex-col gap-2">
          <Label className="flex-wrap" htmlFor={NOTE_FORM_FIELD_IDS.customCategory}>
            {t("customCategory")}{" "}
            <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
          </Label>
          <Input
            aria-describedby={
              errors.customCategory ? NOTE_FORM_FIELD_IDS.customCategoryError : undefined
            }
            aria-invalid={errors.customCategory !== undefined}
            autoComplete="off"
            className="h-10"
            id={NOTE_FORM_FIELD_IDS.customCategory}
            maxLength={NOTE_INPUT_LIMITS.customCategoryMax}
            placeholder={t("customCategoryPlaceholder")}
            {...register("customCategory")}
          />
          <FieldError error={errors.customCategory} id={NOTE_FORM_FIELD_IDS.customCategoryError} />
        </div>
      ) : null}
    </>
  );
}

export function NoteFlagFields({ control }: { control: NoteFormControl }) {
  const t = useTranslations("notes.form");

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
      {NOTE_FLAG_FIELDS.map((flag) => (
        <Controller
          control={control}
          key={flag.name}
          name={flag.name}
          render={({ field }) => (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Label className="cursor-pointer" htmlFor={flag.id}>
                  {t(flag.label)}
                </Label>
                <p className="text-xs text-muted-foreground" id={flag.helpId}>
                  {t(flag.help)}
                </p>
              </div>
              <Switch
                aria-describedby={flag.helpId}
                checked={field.value}
                id={flag.id}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      ))}
    </div>
  );
}

export function NoteTextField({ control, errors, register }: NoteFieldsProps) {
  const t = useTranslations("notes.form");
  const text = useWatch({ control, name: "text" });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={NOTE_FORM_FIELD_IDS.text}>
        {t("text")}{" "}
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      </Label>
      <Textarea
        aria-describedby={
          errors.text
            ? `${NOTE_FORM_FIELD_IDS.textError} ${NOTE_FORM_FIELD_IDS.textCounter}`
            : NOTE_FORM_FIELD_IDS.textCounter
        }
        aria-invalid={errors.text !== undefined}
        className="min-h-32"
        id={NOTE_FORM_FIELD_IDS.text}
        maxLength={NOTE_INPUT_LIMITS.textMax}
        placeholder={t("textPlaceholder")}
        {...register("text")}
      />
      <div className="flex items-center justify-between gap-2">
        <FieldError error={errors.text} id={NOTE_FORM_FIELD_IDS.textError} />
        <span
          className="ml-auto text-xs text-muted-foreground tabular-nums"
          id={NOTE_FORM_FIELD_IDS.textCounter}
        >
          {text.length} / {NOTE_INPUT_LIMITS.textMax}
        </span>
      </div>
    </div>
  );
}
