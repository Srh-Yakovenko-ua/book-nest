"use client";

import type { Nullable, OwnSpeciesView, SpeciesOptionView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import type { SpeciesSelection } from "../model/species-selection";

import { useMergeSpecies } from "../api/use-merge-species";
import { toSpeciesFailure } from "../model/species-failure";
import { OwnSpeciesUsage } from "./own-species-usage";
import { SpeciesFailureMessage } from "./species-failure-message";
import { SpeciesPicker } from "./species-picker";

type MergeOwnSpeciesPanelProps = {
  initialTarget: Nullable<SpeciesSelection>;
  onBack: () => void;
  onMerged: (target: SpeciesOptionView) => void;
  species: OwnSpeciesView;
};

type MergeStep = "choose" | "confirm";

const MERGE_TARGET_INPUT_ID = "merge-own-species-target";

export function MergeOwnSpeciesPanel({
  initialTarget,
  onBack,
  onMerged,
  species,
}: MergeOwnSpeciesPanelProps) {
  const t = useTranslations("species.manage.mergePanel");
  const tToast = useTranslations("species.manage.toast");
  const mergeSpecies = useMergeSpecies();
  const [target, setTarget] = useState<Nullable<SpeciesSelection>>(initialTarget);
  const [step, setStep] = useState<MergeStep>("choose");
  const confirmSectionRef = useRef<HTMLElement>(null);
  const confirmLabelId = useId();
  const confirmNoteId = useId();

  useEffect(() => {
    if (step === "confirm") confirmSectionRef.current?.focus();
  }, [step]);

  const failure = mergeSpecies.isError ? toSpeciesFailure(mergeSpecies.error) : null;

  function confirmMerge() {
    if (target === null) return;
    mergeSpecies.mutate(
      { input: { targetId: target.id }, sourceId: species.id },
      {
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
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("sourceLabel")}
        </span>
        <span className="text-sm font-medium break-words text-foreground">{species.name}</span>
        <span className="text-xs text-muted-foreground">
          <OwnSpeciesUsage usage={species.usage} />
        </span>
      </section>

      {step === "choose" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={MERGE_TARGET_INPUT_ID}>{t("targetLabel")}</Label>
          <SpeciesPicker
            excludeId={species.id}
            inputId={MERGE_TARGET_INPUT_ID}
            label={t("targetLabel")}
            onChange={setTarget}
            placeholder={t("targetPlaceholder")}
            value={target}
          />
          <p className="text-xs text-muted-foreground">{t("targetHint")}</p>
        </div>
      ) : (
        <section
          aria-describedby={confirmNoteId}
          aria-labelledby={confirmLabelId}
          aria-live="polite"
          className="flex flex-col gap-2 rounded-xl border border-accent-border bg-accent/50 p-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          ref={confirmSectionRef}
          tabIndex={-1}
        >
          <span
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            id={confirmLabelId}
          >
            {t("confirmLabel")}
          </span>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span className="min-w-0 break-words">{species.name}</span>
            <UiIcon aria-hidden className="shrink-0 text-icon" name="arrow-right" size={16} />
            <span className="min-w-0 break-words">{target?.label}</span>
          </p>
          <p className="text-xs text-muted-foreground" id={confirmNoteId}>
            {t("confirmNote", { source: species.name, target: target?.label ?? "" })}
          </p>
        </section>
      )}

      {failure === null ? null : <SpeciesFailureMessage failure={failure} />}

      <DialogFooter>
        <Button
          disabled={mergeSpecies.isPending}
          onClick={() => {
            if (step === "confirm") {
              setStep("choose");
              mergeSpecies.reset();
              return;
            }
            onBack();
          }}
          type="button"
          variant="secondary"
        >
          {t("back")}
        </Button>
        {step === "choose" ? (
          <Button
            disabled={target === null}
            key="next"
            onClick={() => setStep("confirm")}
            type="button"
          >
            {t("next")}
          </Button>
        ) : (
          <Button
            disabled={target === null || mergeSpecies.isPending}
            key="confirm"
            loading={mergeSpecies.isPending}
            onClick={(event) => {
              if (event.detail > 1) return;
              confirmMerge();
            }}
            type="button"
          >
            {t("confirm")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
