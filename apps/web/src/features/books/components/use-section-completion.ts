"use client";

import { type Control, useFormState, useWatch } from "react-hook-form";

import type { CreateBookFormValues } from "../model/create-book-form";
import type { SectionFieldConfig } from "../model/section-completeness";

import { computeSectionComplete } from "../model/section-completeness";

export function useSectionCompletion(
  control: Control<CreateBookFormValues>,
  fields: readonly SectionFieldConfig[],
): boolean {
  const values = useWatch({ control, name: fields.map((field) => field.name) });
  const { errors } = useFormState({ control });

  const valuesByName: Record<string, unknown> = {};
  fields.forEach((field, index) => {
    valuesByName[field.name] = values[index];
  });

  return computeSectionComplete(fields, valuesByName, errors);
}
