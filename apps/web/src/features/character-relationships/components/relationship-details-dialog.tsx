"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { RelationshipAction } from "../model/relationship-adapter";
import type { RelationshipScope } from "../model/relationship-scope";

import { toRelationshipScopeKey } from "../model/relationship-scope";
import { RelationshipDetailsContent } from "./relationship-details-content";

type RelationshipDetailsDialogProps = {
  onClose: () => void;
  onDelete?: RelationshipAction;
  onEdit?: RelationshipAction;
  open: boolean;
  relationshipId: string;
  scope: RelationshipScope;
};

export function RelationshipDetailsDialog({
  onClose,
  onDelete,
  onEdit,
  open,
  relationshipId,
  scope,
}: RelationshipDetailsDialogProps) {
  const t = useTranslations("relationships.details");
  const contentKey = JSON.stringify([relationshipId, toRelationshipScopeKey(scope)]);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="min-w-0 pr-8 text-left">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        </DialogHeader>
        <RelationshipDetailsContent
          actions={{ onDelete, onEdit }}
          key={contentKey}
          relationshipId={relationshipId}
          scope={scope}
        />
      </DialogContent>
    </Dialog>
  );
}
