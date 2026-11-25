"use client";

import type { WeekStartDay } from "@app/shared";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TimezoneRow } from "./timezone-row";
import { WeekStartRow } from "./week-start-row";

type RegionalSettingsSectionProps = {
  timezone: string;
  weekStartDay: WeekStartDay;
};

export function RegionalSettingsSection({ timezone, weekStartDay }: RegionalSettingsSectionProps) {
  const t = useTranslations("settings.regional");

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TimezoneRow timezone={timezone} />
        <WeekStartRow weekStartDay={weekStartDay} />
      </CardContent>
    </Card>
  );
}
