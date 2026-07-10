"use client";

import type { LoanListItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useReturnLoan } from "../api/use-loan-actions";
import { restoreLoanTriggerFocus } from "../model/loan-focus";

type ReturnLoanDialogProps = {
  loan: LoanListItemView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ReturnLoanDialog({ loan, onOpenChange, open }: ReturnLoanDialogProps) {
  const t = useTranslations("loans.return");
  const tActions = useTranslations("books.actions");
  const returnLoan = useReturnLoan();

  const isBorrowed = loan.type === "borrowed_from_someone";

  function onConfirm() {
    returnLoan.mutate(loan.book.id, {
      onError: () => toast.error(t("error")),
      onSuccess: () => {
        toast.success(t("success"));
        onOpenChange(false);
      },
    });
  }

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!returnLoan.isPending) onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => restoreLoanTriggerFocus(event, loan.id)}
        size="sm"
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="check-circle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{isBorrowed ? t("titleBorrowed") : t("titleLent")}</AlertDialogTitle>
          <AlertDialogDescription>
            {isBorrowed ? t("descriptionBorrowed") : t("descriptionLent")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={returnLoan.isPending}>
            {tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={returnLoan.isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {returnLoan.isPending ? t("returning") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
