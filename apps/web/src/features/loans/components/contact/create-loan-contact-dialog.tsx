"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { LoanContactConflictAction, LoanContactResolution } from "./create-loan-contact-form";

import { CreateLoanContactForm } from "./create-loan-contact-form";

type CreateLoanContactDialogProps = {
  conflictAction: LoanContactConflictAction;
  initialName?: string;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  onResolved: (resolution: LoanContactResolution) => void;
  open: boolean;
};

export function CreateLoanContactDialog({
  conflictAction,
  initialName,
  onCloseAutoFocus,
  onOpenChange,
  onResolved,
  open,
}: CreateLoanContactDialogProps) {
  const t = useTranslations("loans.contactCreate");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateLoanContactForm
            conflictAction={conflictAction}
            initialName={initialName ?? ""}
            onCancel={() => onOpenChange(false)}
            onResolved={onResolved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
