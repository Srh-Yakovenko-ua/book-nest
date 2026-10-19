"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  RelationshipAuthoringSubject,
  RelationshipDraftState,
} from "../model/relationship-authoring";

import { useRelationshipEditable } from "../api/use-relationship-editable";
import { isRelationshipGone } from "../model/relationship-save-error";
import { RelationshipEditForm } from "./relationship-edit-form";
import { RelationshipsErrorState } from "./relationships-error-state";

type RelationshipEditContentProps = {
  onCancel: () => void;
  onDraftChange: (draft: RelationshipDraftState) => void;
  onSaved: () => void;
  relationshipId: string;
  subject: RelationshipAuthoringSubject;
};

export function RelationshipEditContent({
  onCancel,
  onDraftChange,
  onSaved,
  relationshipId,
  subject,
}: RelationshipEditContentProps) {
  const t = useTranslations("relationships.editor");
  const editable = useRelationshipEditable({ relationshipId });

  if (editable.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4" role="status">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (editable.isError) {
    if (isRelationshipGone(editable.error)) {
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-medium text-foreground">{t("gone.title")}</p>
            <p className="text-xs text-muted-foreground">{t("gone.description")}</p>
          </div>
          <DialogFooter>
            <Button onClick={onCancel} type="button" variant="secondary">
              {t("actions.close")}
            </Button>
          </DialogFooter>
        </div>
      );
    }
    return (
      <RelationshipsErrorState
        description={t("loadError.description")}
        onRetry={() => void editable.refetch()}
        retryLabel={t("loadError.retry")}
        title={t("loadError.title")}
      />
    );
  }

  return (
    <RelationshipEditForm
      onCancel={onCancel}
      onDraftChange={onDraftChange}
      onSaved={onSaved}
      relationship={editable.data}
      subject={subject}
    />
  );
}
