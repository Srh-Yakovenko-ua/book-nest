"use client";

import type { OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { StatusChipGroup } from "./status-chip-group";

const OWNERSHIP_STATUS_VALUES = OwnershipStatusSchema.options;
const DEFAULT_OWNERSHIP_STATUS: OwnershipStatus = "owned";

type BookOwnershipStatusDialogProps = {
  bookCount: number;
  defaultValue?: OwnershipStatus;
  onConfirm: (ownershipStatus: OwnershipStatus) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function BookOwnershipStatusDialog({
  bookCount,
  defaultValue,
  onConfirm,
  onOpenChange,
  open,
}: BookOwnershipStatusDialogProps) {
  const t = useTranslations("books.library.ownershipDialog");
  const tOptions = useTranslations("books.ownershipStatus.options");
  const [value, setValue] = useState<OwnershipStatus>(defaultValue ?? DEFAULT_OWNERSHIP_STATUS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(defaultValue ?? DEFAULT_OWNERSHIP_STATUS);
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
            const match = OWNERSHIP_STATUS_VALUES.find((status) => status === next);
            if (match) setValue(match);
          }}
          options={OWNERSHIP_STATUS_VALUES.map((status) => ({
            label: tOptions(status),
            value: status,
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
