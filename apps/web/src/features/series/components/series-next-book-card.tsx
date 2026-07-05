"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import { seriesProgress } from "../model/series-derive";

type SeriesNextBookCardProps = {
  details: SeriesDetailsView;
};

export function SeriesNextBookCard({ details }: SeriesNextBookCardProps) {
  const t = useTranslations("series.details.next");
  const progress = seriesProgress(details);
  const { nextBook } = details;

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {details.booksInSeries === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : progress.fullyRead || nextBook === null ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UiIcon className="text-success" name="check-circle" size={16} />
            {t("allRead")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <p className="font-heading text-base leading-snug font-medium text-ink">
                {nextBook.title}
              </p>
              {nextBook.partNumber === null ? null : (
                <p className="text-xs text-muted-foreground">
                  {t("book", { number: nextBook.partNumber })}
                </p>
              )}
            </div>
            <Button asChild className="self-start" size="sm" variant="outline">
              <Link href={`/books/${nextBook.id}`}>
                {t("cta")}
                <UiIcon name="arrow-right" size={16} />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
