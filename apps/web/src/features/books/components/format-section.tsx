"use client";

import type { BookFormat } from "@app/shared";

import { useTranslations } from "next-intl";
import { type Control, Controller } from "react-hook-form";

import type { CreateBookFormValues } from "../model/create-book-form";

import { FORMAT_OPTIONS } from "../model/book-status-fields";
import { FORMAT_FIELDS } from "../model/section-completeness";
import { FormSection } from "./form-section";
import { StatusChipGroup } from "./status-chip-group";
import { useSectionCompletion } from "./use-section-completion";

type FormatSectionProps = {
  control: Control<CreateBookFormValues>;
};

export function FormatSection({ control }: FormatSectionProps) {
  const t = useTranslations("books");
  const complete = useSectionCompletion(control, FORMAT_FIELDS);

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("format.description")}
      icon="layers"
      title={t("format.title")}
    >
      <Controller
        control={control}
        name="formats"
        render={({ field }) => (
          <StatusChipGroup
            label={t("format.title")}
            mode="multi"
            onValueChange={(next) => field.onChange(next.filter(isBookFormat))}
            options={FORMAT_OPTIONS.map((value) => ({
              label: t(`format.options.${value}`),
              value,
            }))}
            value={field.value ?? []}
          />
        )}
      />
    </FormSection>
  );
}

function isBookFormat(value: string): value is BookFormat {
  return (FORMAT_OPTIONS as readonly string[]).includes(value);
}
