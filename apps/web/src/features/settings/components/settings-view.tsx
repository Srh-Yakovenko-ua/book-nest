"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { useSettings } from "../api/use-settings";
import { NotificationSettingsSection } from "./notification-settings-section";
import { RegionalSettingsSection } from "./regional-settings-section";

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
      <SkeletonCard description={<Skeleton className="h-4 w-3/4" />}>
        <SkeletonRow control={<Skeleton className="mt-0.5 h-5 w-8 rounded-full" />} />
        <div className="flex flex-col gap-4">
          <SkeletonRow control={<Skeleton className="mt-0.5 h-5 w-8 rounded-full" />} />
          <div className="ml-1 border-l-2 border-border pl-4">
            <SkeletonRow control={<Skeleton className="h-8 w-32" />} />
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-full max-w-md" />
          <Skeleton className="h-7 w-52" />
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonRow control={<Skeleton className="h-8 w-full sm:w-72" />} />
        <SkeletonRow
          control={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11 w-48 rounded-full" />
              <Skeleton className="h-3 w-36" />
            </div>
          }
        />
      </SkeletonCard>
    </div>
  );
}

function SkeletonCard({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <Card className="gap-5">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        {description}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

function SkeletonRow({ control }: { control: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      {control}
    </div>
  );
}
