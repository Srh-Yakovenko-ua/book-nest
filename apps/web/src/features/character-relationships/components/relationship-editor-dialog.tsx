"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiscardConfirmDialog } from "@/features/books";

import type {
  RelationshipAuthoringContext,
  RelationshipDraftState,
  RelationshipEditorTarget,
} from "../model/relationship-authoring";

import { toRelationshipAuthoringSubject } from "../model/relationship-authoring";
import { focusFirstRelationshipControl } from "../model/relationship-editor-focus";
import { useRelationshipDraftGuard } from "../model/use-relationship-draft-guard";
import { RelationshipCreateForm } from "./relationship-create-form";
import { RelationshipEditContent } from "./relationship-edit-content";

const CLEAN_DRAFT: RelationshipDraftState = { isDirty: false, isPending: false };

export type RelationshipEditorDialogProps = RelationshipAuthoringContext & {
  onClose: () => void;
  open: boolean;
  target: RelationshipEditorTarget;
};

export function RelationshipEditorDialog(props: RelationshipEditorDialogProps) {
  const { onClose, open, target } = props;
  const subject = toRelationshipAuthoringSubject(props);
  const t = useTranslations("relationships.editor");
  const tDiscardChanges = useTranslations("common.discardChanges");
  const [draft, setDraft] = useState<RelationshipDraftState>(CLEAN_DRAFT);
  const contentRef = useRef<HTMLDivElement>(null);
  const isEdit = target.mode === "edit";

  function focusDraft() {
    focusFirstRelationshipControl(contentRef.current);
  }

  const guard = useRelationshipDraftGuard({
    focusDraft,
    isDirty: draft.isDirty,
    isOpen: open,
    isPending: draft.isPending,
    onClose,
  });

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) guard.requestClose();
        }}
        open={open}
      >
        <DialogContent
          className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDraft();
          }}
          ref={contentRef}
        >
          <DialogHeader className="min-w-0 pr-8 text-left">
            <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>
              {isEdit ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>
          {target.mode === "create" ? (
            <RelationshipCreateForm
              onCancel={guard.requestClose}
              onDraftChange={setDraft}
              onSaved={onClose}
              subject={subject}
            />
          ) : (
            <RelationshipEditContent
              onCancel={guard.requestClose}
              onDraftChange={setDraft}
              onSaved={onClose}
              relationshipId={target.relationshipId}
              subject={subject}
            />
          )}
        </DialogContent>
      </Dialog>

      <DiscardConfirmDialog
        cancelLabel={tDiscardChanges("cancel")}
        confirmLabel={tDiscardChanges("confirm")}
        description={t("discard.description")}
        title={t("discard.title")}
        {...guard.discardDialog}
      />
    </>
  );
}
