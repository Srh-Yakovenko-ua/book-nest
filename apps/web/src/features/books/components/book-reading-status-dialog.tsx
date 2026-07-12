"use client";

import type { ReadingStatus } from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readingStatuses } from "@/lib/book-status";

import { StatusChipGroup } from "./status-chip-group";

const READING_STATUS_VALUES = ReadingStatusSchema.options;
const DEFAULT_READING_STATUS: ReadingStatus = "reading";

type BookReadingStatusDialogProps = {
  bookCount: number;
  defaultValue?: ReadingStatus;
  onConfirm: (readingStatus: ReadingStatus) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function BookReadingStatusDialog({
  bookCount,
  defaultValue,
  onConfirm,
  onOpenChange,
  open,
}: BookReadingStatusDialogProps) {
  const t = useTranslations("books.library.readingStatusDialog");
  const tOptions = useTranslations("books.readingStatus.options");
  const [value, setValue] = useState<ReadingStatus>(defaultValue ?? DEFAULT_READING_STATUS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(defaultValue ?? DEFAULT_READING_STATUS);
  }, [open, defaultValue]);

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirm(value);
      onOpenChange(false);
    } catch {
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={(next) => !isSubmitting && onOpenChange(next)} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count: bookCount })}</DialogDescription>
        </DialogHeader>
        <StatusChipGroup
          label={t("title")}
          onValueChange={(next) => {
            const match = READING_STATUS_VALUES.find((status) => status === next);
            if (match) setValue(match);
          }}
          options={readingStatuses.map((entry) => ({
            icon: <UiIcon name={entry.icon} size={16} />,
            label: tOptions(entry.value),
            value: entry.value,
          }))}
          value={value}
        />
        <DialogFooter>
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} variant="secondary">
            {t("cancel")}
          </Button>
          <Button
            disabled={isSubmitting}
            loading={isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
