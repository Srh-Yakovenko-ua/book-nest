"use client";

import type { CharacterDeletionPreview } from "@app/shared";

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
import { Skeleton } from "@/components/ui/skeleton";

import { useDeletionPreview } from "../api/use-deletion-preview";

const DELETION_IMPACT_ROWS = [
  { key: "appearanceCount", label: "appearances" },
  { key: "roleCount", label: "roles" },
  { key: "aliasCount", label: "aliases" },
  { key: "tagCount", label: "tags" },
  { key: "formCount", label: "forms" },
  { key: "groupCount", label: "groups" },
  { key: "relationshipCount", label: "relationships" },
  { key: "theoryCount", label: "theories" },
] as const satisfies readonly { key: keyof CharacterDeletionPreview; label: string }[];

type DeleteCharacterDialogProps = {
  characterId: null | string;
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeleteCharacterDialog({
  characterId,
  isDeleting,
  onConfirm,
  onOpenChange,
  open,
}: DeleteCharacterDialogProps) {
  const t = useTranslations("characters.delete");
  const preview = useDeletionPreview(characterId ?? "", open && characterId !== null);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("previewIntro")}
          </span>
          {preview.isPending ? <Skeleton className="h-4 w-40" /> : null}
          {preview.isError ? <p className="text-foreground">{t("previewUnavailable")}</p> : null}
          {preview.data === undefined ? null : <DeletionImpactList preview={preview.data} />}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant="destructive"
          >
            {isDeleting ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeletionImpactList({ preview }: { preview: CharacterDeletionPreview }) {
  const t = useTranslations("characters.delete");

  const rows = DELETION_IMPACT_ROWS.filter((row) => preview[row.key] > 0);

  if (rows.length === 0) return <p className="text-foreground">{t("noRelatedData")}</p>;

  return (
    <ul className="flex flex-col gap-1 text-foreground">
      {rows.map((row) => (
        <li key={row.key}>{t(row.label, { count: preview[row.key] })}</li>
      ))}
    </ul>
  );
}
