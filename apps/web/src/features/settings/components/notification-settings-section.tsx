"use client";

import type { EmailNotifications } from "@app/shared";

import { LOAN_REMINDER_LEAD_DAYS } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { useTestNotification } from "../api/use-test-notification";
import { useUpdateSettings } from "../api/use-update-settings";

const EMAIL_TOGGLES = {
  comingSoon: [
    "readingReminders",
    "readingGoalReminders",
    "weeklyReadingSummary",
    "monthlyReadingReport",
  ],
  live: ["deliveryReminders", "borrowedBookReminders"],
} as const satisfies Record<"comingSoon" | "live", readonly (keyof EmailNotifications)[]>;

type ComingSoonEmailToggle = (typeof EMAIL_TOGGLES.comingSoon)[number];

type LiveEmailToggle = (typeof EMAIL_TOGGLES.live)[number];

type NotificationSettingsSectionProps = {
  emailNotifications: EmailNotifications;
  loanReminderLeadDays: number;
};

export function NotificationSettingsSection({
  emailNotifications,
  loanReminderLeadDays,
}: NotificationSettingsSectionProps) {
  const t = useTranslations("settings.notifications");

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {EMAIL_TOGGLES.live.map((field) => (
            <EmailToggleRow checked={emailNotifications[field]} field={field} key={field} />
          ))}
          <LeadDaysRow leadDays={loanReminderLeadDays} />
        </div>

        <Separator />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-foreground">{t("upcoming.title")}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("upcoming.description")}
            </p>
          </div>
          {EMAIL_TOGGLES.comingSoon.map((field) => (
            <UnavailableToggleRow field={field} key={field} />
          ))}
        </div>

        <Separator />

        <TestNotificationRow />
      </CardContent>
    </Card>
  );
}

function clampLeadDays(value: number): number {
  return Math.min(
    LOAN_REMINDER_LEAD_DAYS.max,
    Math.max(LOAN_REMINDER_LEAD_DAYS.min, Math.round(value)),
  );
}

function EmailToggleRow({ checked, field }: { checked: boolean; field: LiveEmailToggle }) {
  const t = useTranslations("settings.notifications");
  const tToast = useTranslations("settings.toast");
  const generatedId = useId();
  const updateSettings = useUpdateSettings();

  const switchId = `settings-${field}-${generatedId}`;
  const descriptionId = `settings-${field}-description-${generatedId}`;
  const value = updateSettings.isPending
    ? (updateSettings.variables?.emailNotifications?.[field] ?? checked)
    : checked;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={switchId}>{t(`toggles.${field}.label`)}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground" id={descriptionId}>
          {t(`toggles.${field}.description`)}
        </p>
      </div>
      <Switch
        aria-describedby={descriptionId}
        aria-disabled={updateSettings.isPending}
        checked={value}
        className="mt-0.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        id={switchId}
        onCheckedChange={(next) => {
          if (updateSettings.isPending) return;
          const emailNotifications: Partial<EmailNotifications> = { [field]: next };
          updateSettings.mutate(
            { emailNotifications },
            {
              onError: () => toast.error(tToast("error")),
              onSuccess: () => toast.success(tToast("saved")),
            },
          );
        }}
      />
    </div>
  );
}

function LeadDaysRow({ leadDays }: { leadDays: number }) {
  const t = useTranslations("settings.notifications.leadDays");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("settings.toast");
  const generatedId = useId();
  const updateSettings = useUpdateSettings();

  const stepperId = `settings-lead-days-${generatedId}`;
  const hintId = `settings-lead-days-hint-${generatedId}`;
  const value = updateSettings.isPending
    ? (updateSettings.variables?.loanReminderLeadDays ?? leadDays)
    : leadDays;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={stepperId}>{t("label")}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint", { max: LOAN_REMINDER_LEAD_DAYS.max, min: LOAN_REMINDER_LEAD_DAYS.min })}
        </p>
      </div>
      <NumberStepper
        ariaLabel={t("label")}
        decrementLabel={tCommon("decrement")}
        describedBy={hintId}
        id={stepperId}
        incrementLabel={tCommon("increment")}
        max={LOAN_REMINDER_LEAD_DAYS.max}
        min={LOAN_REMINDER_LEAD_DAYS.min}
        onValueChange={(next) => {
          if (updateSettings.isPending) return;
          const loanReminderLeadDays = clampLeadDays(next);
          if (loanReminderLeadDays === value) return;
          updateSettings.mutate(
            { loanReminderLeadDays },
            {
              onError: () => toast.error(tToast("error")),
              onSuccess: () => toast.success(tToast("saved")),
            },
          );
        }}
        size="sm"
        suffix={t("suffix", { count: value })}
        value={value}
      />
    </div>
  );
}

function TestNotificationRow() {
  const t = useTranslations("settings.notifications.test");
  const generatedId = useId();
  const testNotification = useTestNotification();

  const descriptionId = `settings-test-notification-description-${generatedId}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("label")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground" id={descriptionId}>
          {t("description")}
        </p>
      </div>
      <Button
        aria-describedby={descriptionId}
        aria-disabled={testNotification.isPending}
        className="shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (testNotification.isPending) return;
          testNotification.mutate(undefined, {
            onError: () => toast.error(t("error")),
            onSuccess: () => toast.success(t("success")),
          });
        }}
        size="sm"
        variant="secondary"
      >
        <UiIcon name="bell" size={14} />
        {t("button")}
      </Button>
    </div>
  );
}

function UnavailableToggleRow({ field }: { field: ComingSoonEmailToggle }) {
  const t = useTranslations("settings.notifications");
  const generatedId = useId();

  const switchId = `settings-${field}-${generatedId}`;
  const descriptionId = `settings-${field}-description-${generatedId}`;
  const badgeId = `settings-${field}-badge-${generatedId}`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-muted-foreground" htmlFor={switchId}>
            {t(`toggles.${field}.label`)}
          </Label>
          <Badge id={badgeId} variant="secondary">
            {t("comingSoon")}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground" id={descriptionId}>
          {t(`toggles.${field}.description`)}
        </p>
      </div>
      <Switch
        aria-describedby={`${badgeId} ${descriptionId}`}
        aria-disabled="true"
        checked={false}
        className="mt-0.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        id={switchId}
      />
    </div>
  );
}
