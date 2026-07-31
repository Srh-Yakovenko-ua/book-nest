"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useSettings } from "../api/use-settings";
import { NotificationSettingsSection } from "./notification-settings-section";
import { RegionalSettingsSection } from "./regional-settings-section";

const SKELETON_ROW_COUNT = 4;

export function SettingsView() {
  const t = useTranslations("settings.page");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("description")}
        </p>
      </header>

      <SettingsSections />
    </div>
  );
}

function SettingsErrorBlock({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("settings.states.error");

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" role="alert">
          <UiIcon className="text-muted-foreground" name="alert-circle" size={22} />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{t("title")}</p>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
          <Button onClick={onRetry} size="sm" variant="secondary">
            <UiIcon name="refresh" size={14} />
            {t("retry")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsSections() {
  const settings = useSettings();

  if (settings.isPending) return <SettingsSkeleton />;
  if (settings.isError) return <SettingsErrorBlock onRetry={() => void settings.refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <NotificationSettingsSection
        emailNotifications={settings.data.emailNotifications}
        loanReminderLeadDays={settings.data.loanReminderLeadDays}
      />
      <RegionalSettingsSection
        timezone={settings.data.timezone}
        weekStartDay={settings.data.weekStartDay}
      />
    </div>
  );
}

function SettingsSkeleton() {
  const t = useTranslations("settings.states");

  return (
    <div className="flex max-w-3xl flex-col gap-6" role="status">
      <span className="sr-only">{t("loading")}</span>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <div className="flex items-start justify-between gap-4" key={index}>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="mt-0.5 h-5 w-8 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-full sm:max-w-sm" />
        </CardContent>
      </Card>
    </div>
  );
}
