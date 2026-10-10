"use client";

import type { Nullable, OwnSpeciesView, SpeciesUsage } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { useDeleteSpecies } from "../api/use-delete-species";
import { useSpeciesDeletionPreview } from "../api/use-species-deletion-preview";
import { toSpeciesFailure } from "../model/species-failure";
import { OwnSpeciesUsage } from "./own-species-usage";
import { SpeciesFailureMessage } from "./species-failure-message";

type DeleteOwnSpeciesPanelProps = {
  onBack: () => void;
  onDeleted: () => void;
  onMergeInstead: () => void;
  species: OwnSpeciesView;
};

export function DeleteOwnSpeciesPanel({
  onBack,
  onDeleted,
  onMergeInstead,
  species,
}: DeleteOwnSpeciesPanelProps) {
  const t = useTranslations("species.manage.deletePanel");
  const tToast = useTranslations("species.manage.toast");
  const preview = useSpeciesDeletionPreview(species.id);
  const deleteSpecies = useDeleteSpecies();
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outcomeRef.current?.focus();
  }, []);

  const failure = deleteSpecies.isError ? toSpeciesFailure(deleteSpecies.error) : null;
  const blockingUsage = failure?.kind === "inUse" ? (failure.usage ?? preview.data ?? null) : null;
  const usage: Nullable<SpeciesUsage> = blockingUsage ?? preview.data ?? null;
  const canDelete = preview.data?.canDelete === true && blockingUsage === null;

  function confirmDelete() {
    deleteSpecies.mutate(species.id, {
      onSuccess: () => {
        toast.success(tToast("deleted", { name: species.name }));
        onDeleted();
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-live="polite"
        className="-m-1 flex flex-col gap-4 rounded-xl p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        ref={outcomeRef}
        tabIndex={-1}
      >
        {preview.isPending ? (
          <div aria-busy className="flex flex-col gap-2">
            <span className="sr-only">{t("checking")}</span>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : null}

        {preview.isError ? (
          <div
            className="flex flex-col items-start gap-2 rounded-xl bg-error-soft p-3"
            role="alert"
          >
            <p className="text-sm text-error">{t("previewFailed")}</p>
            <Button
              onClick={() => void preview.refetch()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t("retry")}
            </Button>
          </div>
        ) : null}

        {usage === null ? null : canDelete ? (
          <p className="text-sm text-foreground">{t("unused", { name: species.name })}</p>
        ) : (
          <section
            className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm"
            role={blockingUsage === null ? undefined : "alert"}
          >
            <p className="flex items-start gap-2 font-medium text-foreground">
              <UiIcon className="mt-0.5 text-warning" name="alert-triangle" size={16} />
              {t("inUse", { name: species.name })}
            </p>
            <p className="text-foreground">
              <OwnSpeciesUsage usage={usage} />
            </p>
            <p className="text-muted-foreground">{t("nextAction")}</p>
            <Button
              className="self-start"
              onClick={onMergeInstead}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("mergeInstead")}
            </Button>
          </section>
        )}
      </div>

      {failure === null || failure.kind === "inUse" ? null : (
        <SpeciesFailureMessage failure={failure} />
      )}

      <DialogFooter>
        <Button
          disabled={deleteSpecies.isPending}
          onClick={onBack}
          type="button"
          variant="secondary"
        >
          {t("back")}
        </Button>
        <Button
          disabled={!canDelete || deleteSpecies.isPending}
          loading={deleteSpecies.isPending}
          onClick={confirmDelete}
          type="button"
          variant="destructive"
        >
          {t("confirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}
