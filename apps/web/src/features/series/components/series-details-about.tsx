"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

type SeriesDetailsAboutProps = {
  details: SeriesDetailsView;
};

export function SeriesDetailsAbout({ details }: SeriesDetailsAboutProps) {
  const t = useTranslations("series.details.about");
  const tStatus = useTranslations("series.status");
  const locale = useLocale();

  const description = details.description?.trim() ?? "";
  const authorsLine =
    details.authors.length > 0
      ? details.authors.map((author) => author.name).join(", ")
      : t("unknown");

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t("description")}</p>
          {description.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("descriptionEmpty")}</p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
              {description}
            </p>
          )}
        </div>

        <dl className="flex flex-col gap-3">
          <AboutRow label={t("status")} value={tStatus(details.status)} />
          <AboutRow label={t("authors")} value={authorsLine} />
          <AboutRow
            label={t("totalBooks")}
            value={details.totalBooks === null ? t("unknown") : String(details.totalBooks)}
          />
          <AboutRow label={t("createdAt")} value={formatDate(details.createdAt, locale)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-foreground/90">{value}</dd>
    </div>
  );
}
