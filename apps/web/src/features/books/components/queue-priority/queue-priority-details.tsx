"use client";

import type { Nullable, QueuePriority, QueuePriorityReason } from "@app/shared";

import { useTranslations } from "next-intl";
import { type Control, type FieldErrors, type UseFormSetValue } from "react-hook-form";

import type { CreateBookFormValues } from "../../model/create-book-form";

import { QUEUE_PRIORITY_META, reasonSupportsDate } from "../../model/queue-priority";
import { QueuePriorityCustomReasonField } from "./queue-priority-custom-reason-field";
import { QueuePriorityReasonSelect } from "./queue-priority-reason-select";
import { QueuePriorityTargetDateField } from "./queue-priority-target-date-field";
import { priorityIconBadgeVariants } from "./queue-priority-variants";

type QueuePriorityDetailsProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  priority: QueuePriority;
  reason: Nullable<QueuePriorityReason>;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function QueuePriorityDetails({
  control,
  errors,
  priority,
  reason,
  setValue,
}: QueuePriorityDetailsProps) {
  const t = useTranslations("books.organization.priority");
  const meta = QUEUE_PRIORITY_META[priority];
  const Icon = meta.icon;
  const showTargetDate = reason !== null && reasonSupportsDate(reason);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 sm:p-5">
      <div className="flex gap-3">
        <span className={priorityIconBadgeVariants({ size: "lg", tone: meta.tone })}>
          <Icon aria-hidden size={22} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">{t(`${priority}.detailTitle`)}</p>
          <p className="text-sm text-muted-foreground">{t(`${priority}.extendedDescription`)}</p>
        </div>
      </div>

      {priority === "high" ? (
        <div className="mt-5 grid gap-4 border-t border-border pt-5">
          <QueuePriorityReasonSelect control={control} setValue={setValue} />
          {showTargetDate ? (
            <QueuePriorityTargetDateField control={control} errors={errors} reason={reason} />
          ) : null}
          {reason === "other" ? (
            <QueuePriorityCustomReasonField control={control} errors={errors} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
