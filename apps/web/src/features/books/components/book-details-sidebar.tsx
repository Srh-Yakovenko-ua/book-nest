"use client";

import type { BookView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { bookFormats, ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";

import { DeliveryBlock } from "./delivery-block";
import { OwnershipBlock } from "./ownership-block";
import { ReadingProgressBlock } from "./reading-progress-block";
import { SeriesPreviewBlock } from "./series-preview-block";

type BookDetailsSidebarProps = {
  book: BookView;
};

export function BookDetailsSidebar({ book }: BookDetailsSidebarProps) {
  const t = useTranslations("books");
  const locale = useLocale();

  const authorNames = book.authors.map((author) => author.name).join(", ");
  const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);

  return (
    <aside className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("details.quickInfo.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            {authorNames.length > 0 ? (
              <InfoRow label={t("fields.author")} value={authorNames} />
            ) : null}
            {book.publisher === null ? null : (
              <InfoRow label={t("fields.publisher")} value={book.publisher.name} />
            )}
            {book.publicationYear === null ? null : (
              <InfoRow
                label={t("editionDetails.fields.publicationYear")}
                value={String(book.publicationYear)}
              />
            )}
            <InfoRow
              label={t("classification.language")}
              value={t(`classification.languageLabels.${book.language}`)}
            />
            {book.pagesCount === null ? null : (
              <InfoRow
                label={t("editionDetails.fields.pagesCount")}
                value={String(book.pagesCount)}
              />
            )}
            {book.ageCategory === "not_specified" ? null : (
              <InfoRow
                label={t("classification.ageCategory")}
                value={t(`classification.ageCategoryLabels.${book.ageCategory}`)}
              />
            )}
            <InfoRow
              label={t("details.quickInfo.addedOn")}
              value={formatDate(book.createdAt, locale)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("details.statuses.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3">
            <StatusRow label={t("readingStatus.title")}>
              {readingBase === undefined ? null : (
                <StatusBadge
                  entry={{
                    ...readingBase,
                    label: t(`readingStatus.options.${book.readingStatus}`),
                  }}
                />
              )}
            </StatusRow>
            <StatusRow label={t("ownershipStatus.title")}>
              {ownershipBase === undefined ? null : (
                <StatusBadge
                  entry={{
                    ...ownershipBase,
                    label: t(`ownershipStatus.options.${book.ownershipStatus}`),
                  }}
                />
              )}
            </StatusRow>
            <StatusRow label={t("format.title")}>
              {book.formats.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t("details.statuses.none")}</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {book.formats.map((value) => {
                    const base = bookFormats.find((entry) => entry.value === value);
                    if (base === undefined) return null;
                    return (
                      <StatusBadge
                        entry={{ ...base, label: t(`format.options.${value}`) }}
                        key={value}
                      />
                    );
                  })}
                </div>
              )}
            </StatusRow>
          </dl>
        </CardContent>
      </Card>

      <ReadingProgressBlock book={book} />

      <OwnershipBlock book={book} />

      <DeliveryBlock book={book} />

      <SeriesPreviewBlock book={book} />
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-foreground/90">{value}</dd>
    </div>
  );
}

function StatusRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap justify-end">{children}</dd>
    </div>
  );
}
