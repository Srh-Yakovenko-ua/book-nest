"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";

import { FormSection } from "./form-section";

type BookDetailsAboutProps = {
  book: BookView;
};

export function BookDetailsAbout({ book }: BookDetailsAboutProps) {
  const t = useTranslations("books");
  const description = book.description?.trim() ?? "";

  return (
    <FormSection icon="note" title={t("details.about.title")}>
      {description.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{t("details.about.empty")}</p>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {description}
        </p>
      )}
    </FormSection>
  );
}
