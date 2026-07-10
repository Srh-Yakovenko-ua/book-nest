"use client";

import type { ReadingQueuePlacement } from "@app/shared";

import { ReadingQueuePlacementSchema } from "@app/shared";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type QueuePositionFieldProps = {
  disabled?: boolean;
  error?: string;
  idPrefix?: string;
  onPlacementChange: (placement: ReadingQueuePlacement) => void;
  onPositionChange: (value: string) => void;
  placement: ReadingQueuePlacement;
  position: string;
  queueLength: number;
};

const OPTIONS: readonly ReadingQueuePlacement[] = ["start", "end", "specific"];

export function QueuePositionField({
  disabled = false,
  error,
  idPrefix = "queue-position",
  onPlacementChange,
  onPositionChange,
  placement,
  position,
  queueLength,
}: QueuePositionFieldProps) {
  const t = useTranslations("readingQueue.position");
  const isEmptyQueue = queueLength === 0;
  const positionId = `${idPrefix}-value`;
  const errorId = `${idPrefix}-error`;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">{t("legend")}</span>
      <RadioGroup
        aria-label={t("legend")}
        disabled={disabled}
        onValueChange={(value) => onPlacementChange(ReadingQueuePlacementSchema.parse(value))}
        value={placement}
      >
        {OPTIONS.map((option) => (
          <Label
            className="cursor-pointer items-start gap-2.5 font-normal"
            htmlFor={`${idPrefix}-${option}`}
            key={option}
          >
            <RadioGroupItem className="mt-0.5" id={`${idPrefix}-${option}`} value={option} />
            <span className="text-sm text-foreground">{t(option)}</span>
          </Label>
        ))}
      </RadioGroup>

      {placement === "specific" ? (
        isEmptyQueue ? (
          <p className="text-xs text-muted-foreground">{t("emptyHelper")}</p>
        ) : (
          <div className="flex flex-col gap-2 pl-6">
            <Label htmlFor={positionId}>{t("positionLabel")}</Label>
            <Input
              aria-describedby={error ? `${errorId} ${idPrefix}-helper` : `${idPrefix}-helper`}
              aria-invalid={error !== undefined}
              aria-required
              className="w-28"
              disabled={disabled}
              id={positionId}
              inputMode="numeric"
              onChange={(event) => onPositionChange(event.target.value)}
              required
              type="text"
              value={position}
            />
            <p className="text-xs text-muted-foreground" id={`${idPrefix}-helper`}>
              {t("specificHelper")}
            </p>
            {error === undefined ? null : (
              <p className="text-xs text-destructive" id={errorId} role="alert">
                {error}
              </p>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}
