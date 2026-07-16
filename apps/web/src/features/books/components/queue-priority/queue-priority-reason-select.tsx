"use client";

import type { QueuePriorityReason } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { type Control, Controller, type UseFormSetValue } from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CreateBookFormValues } from "../../model/create-book-form";

import {
  QUEUE_PRIORITY_REASON_ICONS,
  QUEUE_PRIORITY_REASON_LABEL_KEYS,
  QUEUE_PRIORITY_REASON_ORDER,
  reasonSupportsDate,
} from "../../model/queue-priority";

type QueuePriorityReasonSelectProps = {
  control: Control<CreateBookFormValues>;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function QueuePriorityReasonSelect({ control, setValue }: QueuePriorityReasonSelectProps) {
  const t = useTranslations("books.organization.priority");
  const tFields = useTranslations("books");
  const selectId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={selectId}>
        {t("reason.label")}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          {tFields("fields.optional")}
        </span>
      </Label>
      <Controller
        control={control}
        name="queuePriorityReason"
        render={({ field }) => {
          const selected = field.value ?? null;

          function clearDependents(next: null | QueuePriorityReason) {
            if (next !== "other") {
              setValue("queuePriorityReasonCustomText", null, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
            if (next === null || !reasonSupportsDate(next)) {
              setValue("queuePriorityTargetDate", null, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
          }

          return (
            <Select
              onValueChange={(value) => {
                const next = value as QueuePriorityReason;
                field.onChange(next);
                clearDependents(next);
              }}
              value={selected ?? ""}
            >
              <SelectTrigger
                className="h-10 w-full data-[size=default]:h-10"
                clearLabel={t("reason.clear")}
                id={selectId}
                isClearable={selected !== null}
                onClear={() => {
                  field.onChange(null);
                  clearDependents(null);
                }}
              >
                <SelectValue placeholder={t("reason.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {QUEUE_PRIORITY_REASON_ORDER.map((value) => {
                  const Icon = QUEUE_PRIORITY_REASON_ICONS[value];
                  return (
                    <SelectItem key={value} value={value}>
                      <Icon aria-hidden size={16} strokeWidth={1.8} />
                      {t(`reason.options.${QUEUE_PRIORITY_REASON_LABEL_KEYS[value]}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          );
        }}
      />
    </div>
  );
}
