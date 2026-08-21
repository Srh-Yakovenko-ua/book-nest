"use client";

import type { LoanContactView } from "@app/shared";

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

import { useArchiveLoanContact } from "../../api/use-archive-loan-contact";

type ArchiveLoanContactDialogProps = {
  contact: LoanContactView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ArchiveLoanContactDialog({
  contact,
  onOpenChange,
  open,
}: ArchiveLoanContactDialogProps) {
  const t = useTranslations("loans.contactDrawer.archive");
  const tActions = useTranslations("books.actions");
  const archiveContact = useArchiveLoanContact();

  function onConfirm() {
    archiveContact.mutate(contact.id, {
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
        if (!archiveContact.isPending) onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="inbox" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title", { name: contact.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveContact.isPending}>
            {tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={archiveContact.isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {archiveContact.isPending ? t("archiving") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
