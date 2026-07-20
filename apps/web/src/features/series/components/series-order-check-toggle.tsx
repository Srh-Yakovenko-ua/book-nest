"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useSeriesOrderCheckPreference,
  useSetSeriesOrderCheckPreference,
} from "@/features/books/api/use-series-order-check";

type SeriesOrderCheckToggleProps = {
  seriesId: string;
};

export function SeriesOrderCheckToggle({ seriesId }: SeriesOrderCheckToggleProps) {
  const t = useTranslations("series.details.orderCheck");
  const generatedId = useId();
  const preference = useSeriesOrderCheckPreference(seriesId);
  const setPreference = useSetSeriesOrderCheckPreference();

  if (preference.isError) return null;

  const checked = setPreference.isPending
    ? (setPreference.variables?.enabled ?? false)
    : (preference.data?.enabled ?? false);

  const switchId = `series-order-check-${generatedId}`;
  const descriptionId = `series-order-check-description-${generatedId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={switchId}>{t("label")}</Label>
            <p className="text-xs text-muted-foreground" id={descriptionId}>
              {t("description")}
            </p>
          </div>
          {preference.isLoading ? (
            <Skeleton className="mt-0.5 h-5 w-8 rounded-full" />
          ) : (
            <Switch
              aria-describedby={descriptionId}
              checked={checked}
              className="mt-0.5"
              disabled={preference.isLoading || setPreference.isPending}
              id={switchId}
              onCheckedChange={(next) => setPreference.mutate({ enabled: next, seriesId })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
