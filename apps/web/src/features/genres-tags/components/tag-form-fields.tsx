"use client";

import { TAG_DESCRIPTION_MAX, TAG_NAME_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { type Control, Controller, type FieldErrors, type UseFormRegister } from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";

import type { TagFormValues } from "../model/tag-form";

import { TAG_TYPES } from "../model/tags-derive";
import { TagColorPicker } from "./tag-color-picker";

type TagFormFieldsProps = {
  control: Control<TagFormValues>;
  errors: FieldErrors<TagFormValues>;
  idPrefix: string;
  register: UseFormRegister<TagFormValues>;
};

export function TagFormFields({ control, errors, idPrefix, register }: TagFormFieldsProps) {
  const t = useTranslations("genresTags.tagDialog");
  const tType = useTranslations("genresTags.types");

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t("name")}</Label>
        <Input
          aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id={`${idPrefix}-name`}
          maxLength={TAG_NAME_MAX}
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id={`${idPrefix}-name-error`} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-type`}>
          {t("type")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-full data-[size=default]:h-10" id={`${idPrefix}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {tType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-color`}>
          {t("color")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <TagColorPicker
              id={`${idPrefix}-color`}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-description`}>
          {t("description")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={`${idPrefix}-description-counter`}
                aria-invalid={errors.description !== undefined}
                id={`${idPrefix}-description`}
                maxLength={TAG_DESCRIPTION_MAX}
                onChange={field.onChange}
                placeholder={t("descriptionPlaceholder")}
                value={field.value}
              />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums"
                id={`${idPrefix}-description-counter`}
              >
                {field.value.length}/{TAG_DESCRIPTION_MAX}
              </span>
            </>
          )}
        />
        <FieldError error={errors.description} id={`${idPrefix}-description-error`} />
      </div>
    </>
  );
}
