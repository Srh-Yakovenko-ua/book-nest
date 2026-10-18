"use client";

import { useTranslations } from "next-intl";

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
import { assertNever } from "@/lib/assert-never";

import type { RelationshipRevealRequest } from "../model/relationship-reveal";

type RelationshipRevealConfirmDialogProps = {
  onCancel: () => void;
  onConfirm: (request: RelationshipRevealRequest) => void;
  open: boolean;
  request: RelationshipRevealRequest;
};

export function RelationshipRevealConfirmDialog({
  onCancel,
  onConfirm,
  open,
  request,
}: RelationshipRevealConfirmDialogProps) {
  const t = useTranslations("relationships.reveal");

  function copy(): { description: string; title: string } {
    switch (request.kind) {
      case "description":
        return {
          description: t("description.description", { book: request.bookTitle }),
          title: t("description.title"),
        };
      case "type":
        return { description: t("type.description"), title: t("type.title") };
      default:
        return assertNever(request);
    }
  }

  const { description, title } = copy();

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      open={open}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="eye" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(request)}>{t("confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
