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
  if (book.publisher !== null)
    rows.push({ label: t("fields.publisher"), value: book.publisher.name });
  if (book.publicationYear !== null) {
    rows.push({
      label: t("editionDetails.fields.publicationYear"),
      value: String(book.publicationYear),
    });
  }
  if (book.pagesCount !== null) {
    rows.push({ label: t("editionDetails.fields.pagesCount"), value: String(book.pagesCount) });
  }
  if (book.isbn !== null) rows.push({ label: t("editionDetails.fields.isbn"), value: book.isbn });
  if (book.translator !== null) {
    rows.push({ label: t("editionDetails.fields.translator"), value: book.translator });
  }
  if (book.illustrator !== null) {
    rows.push({ label: t("editionDetails.fields.illustrator"), value: book.illustrator });
  }

  const isEmpty = rows.length === 0 && book.dedication === null;

  return (
    <FormSection icon="book" title={t("editionDetails.title")}>
      {isEmpty ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("details.edition.empty")}
        </p>
      ) : null}

      {rows.length === 0 ? null : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div className="flex flex-col gap-0.5" key={row.label}>
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm text-foreground/90">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {book.dedication === null ? null : (
        <figure className="border-l-2 border-border pl-3">
          <figcaption className="mb-1 text-xs text-muted-foreground">
            {t("editionDetails.fields.dedication")}
          </figcaption>
          <blockquote className="text-sm leading-relaxed whitespace-pre-line text-foreground/80 italic">
            {book.dedication}
          </blockquote>
        </figure>
      )}
    </FormSection>
  );
}
