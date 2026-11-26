"use client";

import type { EmailNotifications } from "@app/shared";

import { LOAN_REMINDER_LEAD_DAYS } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { useAutosaveField } from "../hooks/use-autosave-field";
import { FieldSaveStatus } from "./field-save-status";
import { TestNotificationBlock } from "./test-notification-block";

type EmailReminder = Extract<
  keyof EmailNotifications,
  "borrowedBookReminders" | "deliveryReminders"
>;

type NotificationSettingsSectionProps = {
  emailNotifications: EmailNotifications;
  loanReminderLeadDays: number;
};

const LEAD_DAY_OPTIONS = Array.from(
  { length: LOAN_REMINDER_LEAD_DAYS.max - LOAN_REMINDER_LEAD_DAYS.min + 1 },
  (_, index) => LOAN_REMINDER_LEAD_DAYS.min + index,
);

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
        <EmailReminderRow
          checked={emailNotifications.deliveryReminders}
          field="deliveryReminders"
        />
        <div className="flex flex-col gap-4">
          <EmailReminderRow
            checked={emailNotifications.borrowedBookReminders}
            field="borrowedBookReminders"
          />
          <LeadDaysRow leadDays={loanReminderLeadDays} />
        </div>

        <Separator />

        <TestNotificationBlock />
      </CardContent>
    </Card>
  );
}

function EmailReminderRow({ checked, field }: { checked: boolean; field: EmailReminder }) {
  const t = useTranslations("settings.notifications.toggles");
  const generatedId = useId();
  const reminder = useAutosaveField({
    confirmed: checked,
    fromInput: (input) => input.emailNotifications?.[field],
    toInput: (value) => {
      const emailNotifications: Partial<EmailNotifications> = { [field]: value };
      return { emailNotifications };
    },
  });

  const switchRef = useRef<HTMLButtonElement>(null);

  const switchId = `settings-${field}-${generatedId}`;
  const labelId = `settings-${field}-label-${generatedId}`;
  const descriptionId = `settings-${field}-description-${generatedId}`;
  const isSaving = reminder.status === "saving";

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <Label htmlFor={switchId} id={labelId}>
          {t(`${field}.label`)}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground" id={descriptionId}>
          {t(`${field}.description`)}
        </p>
      </div>
      <Switch
        aria-describedby={descriptionId}
        aria-disabled={isSaving}
        checked={reminder.value}
        className="mt-0.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        id={switchId}
        onCheckedChange={reminder.save}
        ref={switchRef}
      />
      <FieldSaveStatus
        className="basis-full"
        fieldLabelId={labelId}
        onRetry={() => {
          switchRef.current?.focus();
          reminder.retry();
        }}
        status={reminder.status}
      />
    </div>
  );
}

function isTypeaheadKey({
  altKey,
  ctrlKey,
  key,
  metaKey,
}: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">): boolean {
  if (altKey || ctrlKey || metaKey) return false;
  return key.length === 1 && key !== " ";
}

function LeadDaysRow({ leadDays }: { leadDays: number }) {
  const t = useTranslations("settings.notifications.leadDays");
  const generatedId = useId();
  const leadDaysField = useAutosaveField({
    confirmed: leadDays,
    fromInput: (input) => input.loanReminderLeadDays,
    toInput: (loanReminderLeadDays) => ({ loanReminderLeadDays }),
  });

  const triggerRef = useRef<HTMLButtonElement>(null);

  const triggerId = `settings-lead-days-${generatedId}`;
  const labelId = `settings-lead-days-label-${generatedId}`;
  const hintId = `settings-lead-days-hint-${generatedId}`;
  const isSaving = leadDaysField.status === "saving";
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="ml-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-l-2 border-border pl-4">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <Label htmlFor={triggerId} id={labelId}>
          {t("label")}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint")}
        </p>
      </div>
      <Select
        onOpenChange={(nextOpen) => {
          if (nextOpen && isSaving) return;
          setIsOpen(nextOpen);
        }}
        onValueChange={(next) => {
          const days = LEAD_DAY_OPTIONS.find((option) => String(option) === next);
          if (days === undefined) return;
          leadDaysField.save(days);
        }}
        open={isOpen}
        value={String(leadDaysField.value)}
      >
        <SelectTrigger
          aria-describedby={hintId}
          aria-disabled={isSaving}
          className="w-32 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          id={triggerId}
          onKeyDown={(event) => {
            if (!isTypeaheadKey(event)) return;
            event.preventDefault();
          }}
          ref={triggerRef}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_DAY_OPTIONS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              {t("option", { count: days })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldSaveStatus
        className="basis-full"
        fieldLabelId={labelId}
        onRetry={() => {
          triggerRef.current?.focus();
          leadDaysField.retry();
        }}
        status={leadDaysField.status}
      />
    </div>
  );
}
