"use client";

import type { UseFormReturn } from "react-hook-form";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { assertNever } from "@/lib/assert-never";

import type {
  RelationshipFormField,
  RelationshipFormInput,
  RelationshipFormValues,
} from "./relationship-form-schema";

import { toRelationshipSaveError } from "./relationship-save-error";

export const RELATIONSHIP_FORM_ROOT_ERROR = "root.server";

type RelationshipSaveErrorReporterOptions = {
  form: UseFormReturn<RelationshipFormInput, unknown, RelationshipFormValues>;
  mode: "create" | "edit";
  onFamilyCycle: (overridable: boolean) => void;
  onGone: () => void;
  revealField: (field: RelationshipFormField) => boolean;
};

export function useRelationshipSaveErrorReporter({
  form,
  mode,
  onFamilyCycle,
  onGone,
  revealField,
}: RelationshipSaveErrorReporterOptions) {
  const t = useTranslations("relationships.editor.errors");
  const tToast = useTranslations("relationships.toast");

  function showFieldError({ field, message }: { field: RelationshipFormField; message: string }) {
    if (!revealField(field)) {
      form.setError(RELATIONSHIP_FORM_ROOT_ERROR, { message });
      return;
    }
    form.setError(field, { message }, { shouldFocus: true });
  }

  const saveFailedMessage = tToast(mode === "create" ? "createError" : "updateError");

  return function reportSaveError(error: unknown) {
    const saveError = toRelationshipSaveError(error);

    switch (saveError.kind) {
      case "familyCycle":
        onFamilyCycle(saveError.overridable);
        return;
      case "field":
        showFieldError({ field: saveError.field, message: t(saveError.reason) });
        return;
      case "gone":
        if (mode === "create") {
          toast.error(saveFailedMessage);
          return;
        }
        toast.error(tToast("gone"));
        onGone();
        return;
      case "invalid":
        for (const field of saveError.fields) {
          showFieldError({ field, message: t("invalidValue") });
        }
        form.setError(RELATIONSHIP_FORM_ROOT_ERROR, { message: t("validation") });
        return;
      case "unknown":
        toast.error(saveFailedMessage);
        return;
      default:
        assertNever(saveError);
    }
  };
}
