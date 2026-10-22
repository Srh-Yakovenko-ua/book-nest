"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import { READING_CALENDAR_PAGE } from "../../model/reading-calendar-params";

export function ReadingCalendarLink() {
  const t = useTranslations("statistics.calendarLink");

  return (
    <Card className="flex-row flex-wrap items-center gap-3 px-4 sm:flex-nowrap sm:gap-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"
      >
        <CalendarDays className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-heading text-base font-semibold text-ink">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button asChild className="w-full sm:w-auto" size="sm" variant="secondary">
        <Link href={READING_CALENDAR_PAGE.path}>{t("action")}</Link>
      </Button>
    </Card>
  );
}
