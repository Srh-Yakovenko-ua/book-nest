"use client";

import type { Nullable, OwnSpeciesView, SpeciesOptionView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { focusOnMount } from "@/lib/focus-on-mount";

import type { SpeciesSelection } from "../model/species-selection";

import { useMergeSpecies } from "../api/use-merge-species";
import { toSpeciesFailure } from "../model/species-failure";
import { ClampedSpeciesName } from "./clamped-species-name";
import { OwnSpeciesUsage } from "./own-species-usage";
import { SpeciesFailureMessage } from "./species-failure-message";
import { SpeciesPicker } from "./species-picker";

type MergeOwnSpeciesPanelProps = {
  busy: boolean;
  initialTarget: Nullable<SpeciesSelection>;
  onBack: () => void;
  onBusyChange: (busy: boolean) => void;
  onMerged: (target: SpeciesOptionView) => void;
  species: OwnSpeciesView;
};

const MERGE_TARGET_INPUT_ID = "merge-own-species-target";

export function MergeOwnSpeciesPanel({
  busy,
  initialTarget,
  onBack,
  onBusyChange,
  onMerged,
  species,
}: MergeOwnSpeciesPanelProps) {
  const t = useTranslations("species.manage.mergePanel");
  const tToast = useTranslations("species.manage.toast");
  const mergeSpecies = useMergeSpecies();
  const [target, setTarget] = useState<Nullable<SpeciesSelection>>(initialTarget);
  const targetInputRef = useRef<Nullable<HTMLInputElement>>(null);
  const previewLabelId = useId();
  const previewDetailsId = useId();

  useEffect(() => {
    targetInputRef.current?.focus();
  }, []);

  const failure = mergeSpecies.isError ? toSpeciesFailure(mergeSpecies.error) : null;

  function changeTarget(next: Nullable<SpeciesSelection>) {
    setTarget(next);
    mergeSpecies.reset();
  }

  function confirmMerge() {
    if (target === null || busy) return;
    onBusyChange(true);
    mergeSpecies.mutate(
      { input: { targetId: target.id }, sourceId: species.id },
      {
        onSettled: () => onBusyChange(false),
        onSuccess: (result) => {
          toast.success(
            tToast("merged", {
              bookOverrides: result.reassigned.bookOverrides,
              characters: result.reassigned.characters,
              name: result.target.name,
            }),
          );
          onMerged(result.target);
        },
      },
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-muted/40 p-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("sourceLabel")}
        </span>
        <ClampedSpeciesName className="text-sm font-medium text-foreground" name={species.name} />
        <span className="text-xs text-muted-foreground">
          <OwnSpeciesUsage usage={species.usage} />
        </span>
      </section>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={MERGE_TARGET_INPUT_ID}>{t("targetLabel")}</Label>
        <SpeciesPicker
          allowCreate={false}
          disabled={busy}
          excludeId={species.id}
          inputId={MERGE_TARGET_INPUT_ID}
          label={t("targetLabel")}
          onChange={changeTarget}
          placeholder={t("targetPlaceholder")}
          ref={(element) => {
            targetInputRef.current = element;
          }}
          value={target}
        />
      </div>

      {target === null ? null : (
        <section
          aria-labelledby={previewLabelId}
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-accent-border bg-accent/50 p-3"
        >
          <span
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            id={previewLabelId}
          >
            {t("previewLabel")}
          </span>
          <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-medium text-foreground">
            <ClampedSpeciesName name={species.name} />
            <UiIcon aria-hidden className="text-icon" name="arrow-right" size={16} />
            <ClampedSpeciesName name={target.label} />
          </p>
          <div
            className="flex flex-col gap-1 text-xs wrap-anywhere text-muted-foreground"
            id={previewDetailsId}
          >
            <p>
              {t("previewMoves", {
                bookOverrides: species.usage.bookOverrides,
                characters: species.usage.characters,
              })}
            </p>
            <p>{t("previewNote", { source: species.name })}</p>
          </div>
        </section>
      )}

      {failure === null ? null : (
        <div
          className="-m-1 rounded-lg p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          ref={focusOnMount}
          tabIndex={-1}
        >
          <SpeciesFailureMessage failure={failure} />
        </div>
      )}

      <DialogFooter>
        <Button disabled={busy} onClick={onBack} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          aria-describedby={target === null ? undefined : previewDetailsId}
          disabled={target === null || busy}
          loading={busy}
          onClick={confirmMerge}
          type="button"
        >
          {t("confirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}
