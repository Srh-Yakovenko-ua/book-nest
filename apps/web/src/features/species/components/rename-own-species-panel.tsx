"use client";

import type { Nullable, OwnSpeciesView, SpeciesOptionView } from "@app/shared";

import { collapseSpaces, SPECIES_SEARCH, SpeciesNameInputSchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { SpeciesSelection } from "../model/species-selection";

import { useRenameSpecies } from "../api/use-rename-species";
import { useSpeciesCandidates } from "../api/use-species-candidates";
import { toSpeciesFailure } from "../model/species-failure";
import { speciesSearchTerm } from "../model/species-search-term";
import { selectionFromOption } from "../model/species-selection";
import { SpeciesFailureMessage } from "./species-failure-message";

type RenameOwnSpeciesPanelProps = {
  onBack: () => void;
  onMergeInto: (target: Nullable<SpeciesSelection>) => void;
  onRenamed: (species: SpeciesOptionView) => void;
  species: OwnSpeciesView;
};

const RENAME_FIELD_IDS = {
  error: "rename-own-species-error",
  input: "rename-own-species",
} as const;

export function RenameOwnSpeciesPanel({
  onBack,
  onMergeInto,
  onRenamed,
  species,
}: RenameOwnSpeciesPanelProps) {
  const t = useTranslations("species.manage.renamePanel");
  const tToast = useTranslations("species.manage.toast");
  const renameSpecies = useRenameSpecies();
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setFocus,
  } = useForm({
    defaultValues: { name: species.name },
    resolver: zodResolver(SpeciesNameInputSchema),
  });

  useEffect(() => {
    setFocus("name", { shouldSelect: true });
  }, [setFocus]);

  const name = useWatch({ control, name: "name" });
  const collapsedName = collapseSpaces(name);
  const isUnchanged = collapsedName === species.name;
  const term = speciesSearchTerm(useDebouncedValue(name, SPECIES_SEARCH.debounceMs));
  const isLookupCurrent = !isUnchanged && term === name.trim();
  const candidates = useSpeciesCandidates({ enabled: isLookupCurrent, name: term });
  const isOther = (option: SpeciesOptionView) => option.id !== species.id;
  const lookup = isLookupCurrent ? candidates.data : undefined;
  const exact =
    lookup?.exact !== undefined && lookup.exact !== null && isOther(lookup.exact)
      ? lookup.exact
      : null;
  const similar = exact === null ? (lookup?.similar ?? []).filter(isOther) : [];
  const failure =
    renameSpecies.isError && renameSpecies.variables.input.name === collapsedName
      ? toSpeciesFailure(renameSpecies.error)
      : null;
  const nameError =
    errors.name === undefined
      ? undefined
      : { message: t("invalid", { max: SPECIES_SEARCH.nameMax }) };

  const submitRename = handleSubmit((input) => {
    if (isUnchanged || exact !== null) return;

    renameSpecies.mutate(
      { input, speciesId: species.id },
      {
        onSuccess: (renamed) => {
          toast.success(tToast("renamed", { name: renamed.name }));
          onRenamed(renamed);
        },
      },
    );
  });

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        void submitRename(event);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={RENAME_FIELD_IDS.input}>{t("label", { name: species.name })}</Label>
        <Input
          aria-describedby={nameError === undefined ? undefined : RENAME_FIELD_IDS.error}
          aria-invalid={nameError !== undefined}
          autoComplete="off"
          className="h-10"
          id={RENAME_FIELD_IDS.input}
          maxLength={SPECIES_SEARCH.nameMax}
          {...register("name")}
        />
        <FieldError error={nameError} id={RENAME_FIELD_IDS.error} />
      </div>

      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {exact === null ? null : <DuplicateHint holder={exact} onMergeInto={onMergeInto} />}
        {similar.length === 0 ? null : (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {t("similar", { names: similar.map((option) => option.name).join(", ") })}
          </p>
        )}
        {failure === null ? null : failure.kind === "duplicate" ? (
          <DuplicateHint holder={failure.holder} onMergeInto={onMergeInto} />
        ) : (
          <SpeciesFailureMessage failure={failure} />
        )}
      </div>

      <DialogFooter>
        <Button
          disabled={renameSpecies.isPending}
          onClick={onBack}
          type="button"
          variant="secondary"
        >
          {t("back")}
        </Button>
        <Button
          disabled={isUnchanged || exact !== null || renameSpecies.isPending}
          loading={renameSpecies.isPending}
          type="submit"
        >
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DuplicateHint({
  holder,
  onMergeInto,
}: {
  holder: Nullable<SpeciesOptionView>;
  onMergeInto: (target: Nullable<SpeciesSelection>) => void;
}) {
  const t = useTranslations("species.manage.renamePanel");

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-foreground sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <UiIcon className="mt-0.5 text-warning" name="alert-triangle" size={16} />
        {holder === null ? t("duplicateUnknown") : t("duplicate", { name: holder.name })}
      </span>
      {holder === null ? null : (
        <Button
          onClick={() => onMergeInto(selectionFromOption(holder))}
          size="xs"
          type="button"
          variant="outline"
        >
          {t("mergeIntoExisting")}
        </Button>
      )}
    </div>
  );
}
