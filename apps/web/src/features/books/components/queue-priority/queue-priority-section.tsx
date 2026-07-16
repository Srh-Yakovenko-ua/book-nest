"use client";

import type { QueuePriority } from "@app/shared";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Control, type FieldErrors, type UseFormSetValue, useWatch } from "react-hook-form";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { CreateBookFormValues } from "../../model/create-book-form";

import { QUEUE_PRIORITY_DEFAULT } from "../../model/book-organization-fields";
import { QueuePriorityDetails } from "./queue-priority-details";
import { QueuePriorityOptions } from "./queue-priority-options";
import { QueuePriorityPositionNote } from "./queue-priority-position-note";

type QueuePrioritySectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function QueuePrioritySection({ control, errors, setValue }: QueuePrioritySectionProps) {
  const t = useTranslations("books.organization.priority");
  const priority = useWatch({ control, name: "queuePriority" }) ?? QUEUE_PRIORITY_DEFAULT;
  const reason = useWatch({ control, name: "queuePriorityReason" }) ?? null;

  function selectPriority(next: QueuePriority) {
    setValue("queuePriority", next, { shouldDirty: true, shouldValidate: true });
    if (next === "high") return;
    setValue("queuePriorityReason", null, { shouldDirty: true, shouldValidate: true });
    setValue("queuePriorityReasonCustomText", null, { shouldDirty: true, shouldValidate: true });
    setValue("queuePriorityTargetDate", null, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={t("info")}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                type="button"
              >
                <Info aria-hidden size={16} strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("info")}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <QueuePriorityOptions activeValue={priority} onSelect={selectPriority} />

      <QueuePriorityDetails
        control={control}
        errors={errors}
        priority={priority}
        reason={reason}
        setValue={setValue}
      />

      <QueuePriorityPositionNote />
    </div>
  );
}
