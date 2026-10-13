"use client";

import type { Nullable, OwnSpeciesView, SpeciesDeletionPreview, SpeciesUsage } from "@app/shared";
import type { UseQueryResult } from "@tanstack/react-query";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { SpeciesFailure } from "../model/species-failure";

import { useDeleteSpecies } from "../api/use-delete-species";
import { useSpeciesDeletionPreview } from "../api/use-species-deletion-preview";
import { toSpeciesFailure } from "../model/species-failure";
import { ClampedSpeciesName } from "./clamped-species-name";
import { OwnSpeciesUsage } from "./own-species-usage";
import { SpeciesFailureMessage } from "./species-failure-message";

type DeleteOutcome =
  | { kind: "blocked"; refusedByServer: boolean; usage: Nullable<SpeciesUsage> }
  | { kind: "checkFailed" }
  | { kind: "checking" }
  | { kind: "confirm" };

type DeleteOwnSpeciesPanelProps = {
  busy: boolean;
  onBack: () => void;
  onBusyChange: (busy: boolean) => void;
  onDeleted: () => void;
  onMergeInstead: () => void;
  species: OwnSpeciesView;
};

export function DeleteOwnSpeciesPanel({
  busy,
  onBack,
  onBusyChange,
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
  const outcome = deleteOutcome(preview, failure);

  function confirmDelete() {
    if (busy) return;
    onBusyChange(true);
    deleteSpecies.mutate(species.id, {
      onError: () => outcomeRef.current?.focus(),
      onSettled: () => onBusyChange(false),
      onSuccess: () => {
        toast.success(tToast("deleted", { name: species.name }));
        onDeleted();
      },
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        aria-live="polite"
        className="-m-1 flex min-w-0 flex-col gap-4 rounded-xl p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        ref={outcomeRef}
        tabIndex={-1}
      >
        <DeleteOutcomeMessage
          name={species.name}
          onRetry={() => void preview.refetch()}
          outcome={outcome}
        />
      </div>

      {failure === null || failure.kind === "inUse" ? null : (
        <SpeciesFailureMessage failure={failure} />
      )}

      <DialogFooter>
        <Button disabled={busy} onClick={onBack} type="button" variant="secondary">
          {outcome.kind === "confirm" ? t("cancel") : t("back")}
        </Button>
        {outcome.kind === "blocked" ? (
          <Button onClick={onMergeInstead} type="button">
            {t("mergeInstead")}
          </Button>
        ) : null}
        {outcome.kind === "confirm" ? (
          <Button
            disabled={busy}
            loading={busy}
            onClick={confirmDelete}
            type="button"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

function deleteOutcome(
  preview: UseQueryResult<SpeciesDeletionPreview>,
  failure: Nullable<SpeciesFailure>,
): DeleteOutcome {
  if (failure?.kind === "inUse") {
    return { kind: "blocked", refusedByServer: true, usage: failure.usage };
  }
  if (preview.isPending || !preview.isFetchedAfterMount) return { kind: "checking" };
  if (preview.isError) return { kind: "checkFailed" };
  if (preview.data.canDelete) return { kind: "confirm" };
  return { kind: "blocked", refusedByServer: false, usage: preview.data };
}

function DeleteOutcomeMessage({
  name,
  onRetry,
  outcome,
}: {
  name: string;
  onRetry: () => void;
  outcome: DeleteOutcome;
}) {
  const t = useTranslations("species.manage.deletePanel");

  switch (outcome.kind) {
    case "blocked":
      return (
        <section
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm"
          role={outcome.refusedByServer ? "alert" : undefined}
        >
          <p className="flex items-start gap-2 font-medium text-foreground">
            <UiIcon className="mt-0.5 shrink-0 text-warning" name="alert-triangle" size={16} />
            {t("inUse")}
          </p>
          <ClampedSpeciesName className="font-medium text-foreground" name={name} />
          {outcome.usage === null ? null : (
            <p className="text-foreground">
              <OwnSpeciesUsage usage={outcome.usage} />
            </p>
          )}
          <p className="text-muted-foreground">{t("nextAction")}</p>
        </section>
      );
    case "checkFailed":
      return (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-error-soft p-3" role="alert">
          <p className="text-sm text-error">{t("previewFailed")}</p>
          <Button onClick={onRetry} size="sm" type="button" variant="secondary">
            {t("retry")}
          </Button>
        </div>
      );
    case "checking":
      return (
        <div aria-busy className="flex flex-col gap-2">
          <span className="sr-only">{t("checking")}</span>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      );
    case "confirm":
      return <p className="text-sm wrap-anywhere text-foreground">{t("unused", { name })}</p>;
    default:
      return assertNever(outcome);
  }
}
