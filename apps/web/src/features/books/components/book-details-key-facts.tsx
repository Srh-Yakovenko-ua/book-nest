"use client";

import type { BookView } from "@app/shared";
import type { LucideIcon } from "lucide-react";

import { Building2, Calendar, Clock, FileText, Languages, Layers, User, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { bookFormats, ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type BookDetailsKeyFactsProps = {
  book: BookView;
  className?: string;
};

export function BookDetailsKeyFacts({ book, className }: BookDetailsKeyFactsProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <QuickInfoCard book={book} />
      <StatusesCard book={book} />
    </div>
  );
}

export function QuickInfoCard({ book, className }: { book: BookView; className?: string }) {
  const t = useTranslations("books");
  const locale = useLocale();

  const authorNames = book.authors.map((author) => author.name).join(", ");

  return (
    <Card className={cn("gap-4 shadow-detail-block", className)}>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("details.quickInfo.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-0">
          {authorNames.length > 0 ? (
            <InfoRow icon={User} label={t("fields.author")} multiline value={authorNames} />
          ) : null}
          {book.publisher === null ? null : (
            <InfoRow icon={Building2} label={t("fields.publisher")} value={book.publisher.name} />
          )}
          {book.publicationYear === null ? null : (
            <InfoRow
              icon={Calendar}
              label={t("editionDetails.fields.publicationYear")}
              value={String(book.publicationYear)}
            />
          )}
          <InfoRow
            icon={Languages}
            label={t("classification.language")}
            value={t(`classification.languageLabels.${book.language}`)}
          />
          {book.formats.length > 0 ? (
            <InfoRow icon={Layers} label={t("details.quickInfo.formats")}>
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
            </InfoRow>
          ) : null}
          {book.pagesCount === null ? null : (
            <InfoRow
              icon={FileText}
              label={t("editionDetails.fields.pagesCount")}
              value={String(book.pagesCount)}
            />
          )}
          {book.ageCategory === "not_specified" ? null : (
            <InfoRow
              icon={Users}
              label={t("classification.ageCategory")}
              value={t(`classification.ageCategoryLabels.${book.ageCategory}`)}
            />
          )}
          <InfoRow
            icon={Clock}
            label={t("details.quickInfo.addedOn")}
            value={formatDate(book.createdAt, locale)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

export function StatusesCard({ book, className }: { book: BookView; className?: string }) {
  const t = useTranslations("books");

  const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);

  return (
    <Card className={cn("gap-4 shadow-detail-block", className)}>
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
        </dl>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  children,
  icon: Icon,
  label,
  multiline = false,
  value,
}: {
  children?: ReactNode;
  icon: LucideIcon;
  label: string;
  multiline?: boolean;
  value?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-2 pb-2 first:pt-0 last:border-0 last:pb-0",
        multiline ? "items-start" : "items-center",
      )}
    >
      <dt className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {label}
      </dt>
      {children === undefined ? (
        <dd
          className={cn(
            "min-w-0 text-right text-xs font-medium text-foreground/90",
            multiline ? "break-words" : "truncate",
          )}
        >
          {value}
        </dd>
      ) : (
        <dd className="flex min-w-0 flex-wrap justify-end gap-1.5">{children}</dd>
      )}
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
