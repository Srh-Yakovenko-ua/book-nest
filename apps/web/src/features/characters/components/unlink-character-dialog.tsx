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

import type { CharacterFactsScope } from "../api/character-keys";

import { useCharacterFactsTotal } from "../api/use-character-facts-total";
import { toUnlinkFactsImpact, UnlinkFactsImpact } from "./unlink-facts-impact";

type UnlinkCharacterDialogProps = {
  isUnlinking: boolean;
  onCloseAutoFocus?: (event: Event) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: CharacterFactsScope;
};

export function UnlinkCharacterDialog({
  isUnlinking,
  onCloseAutoFocus,
  onConfirm,
  onOpenChange,
  open,
  scope,
}: UnlinkCharacterDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} size="sm">
        <UnlinkConfirmation
          isEnabled={open && !isUnlinking}
          isUnlinking={isUnlinking}
          onConfirm={onConfirm}
          scope={scope}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UnlinkConfirmation({
  isEnabled,
  isUnlinking,
  onConfirm,
  scope,
}: {
  isEnabled: boolean;
  isUnlinking: boolean;
  onConfirm: () => void;
  scope: CharacterFactsScope;
}) {
  const t = useTranslations("characters.unlink");
  const factsTotal = useCharacterFactsTotal({ ...scope, enabled: isEnabled });

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <UiIcon name="link" size={24} />
        </AlertDialogMedia>
        <AlertDialogTitle>{t("title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("description")}</AlertDialogDescription>
      </AlertDialogHeader>
      <UnlinkFactsImpact impact={toUnlinkFactsImpact(factsTotal)} />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isUnlinking}>{t("cancel")}</AlertDialogCancel>
        <AlertDialogAction
          disabled={isUnlinking || factsTotal.isPending}
          onClick={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          {isUnlinking ? t("unlinking") : t("confirm")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
