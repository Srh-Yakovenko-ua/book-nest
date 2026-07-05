"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";

import { FormSection } from "./form-section";

type BookDetailsEditionProps = {
  book: BookView;
};

export function BookDetailsEdition({ book }: BookDetailsEditionProps) {
  const t = useTranslations("books");

  const rows: { label: string; value: string }[] = [];
  if (book.isbn !== null) rows.push({ label: t("editionDetails.fields.isbn"), value: book.isbn });
  if (book.translator !== null) {
    rows.push({ label: t("editionDetails.fields.translator"), value: book.translator });
  }
  if (book.illustrator !== null) {
    rows.push({ label: t("editionDetails.fields.illustrator"), value: book.illustrator });
  }

  if (rows.length === 0) return null;

  return (
    <FormSection icon="book" title={t("editionDetails.title")}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div className="flex flex-col gap-0.5" key={row.label}>
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-sm text-foreground/90">{row.value}</dd>
          </div>
        ))}
      </dl>
    </FormSection>
  );
}
