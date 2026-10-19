"use client";

import type { Nullable, RelationshipCategory } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";

import type {
  RelationshipAuthoringSubject,
  RelationshipDraftState,
} from "../model/relationship-authoring";
import type {
  RelationshipFormField,
  RelationshipFormInput,
  RelationshipFormValues,
} from "../model/relationship-form-schema";

import { useCreateRelationship } from "../api/use-create-relationship";
import { relationshipRosterBookId } from "../model/relationship-authoring";
import {
  defaultRelationshipBookId,
  toRelationshipCreateBookStep,
} from "../model/relationship-book-step";
import {
  relationshipCreateDefaults,
  toCreateRelationshipInput,
  toRelationshipEdgeSignature,
} from "../model/relationship-form-input";
import {
  buildRelationshipFormSchema,
  isRelationshipEdgeField,
  RELATIONSHIP_EDGE_FIELDS,
} from "../model/relationship-form-schema";
import { useRelationshipFormMessages } from "../model/use-relationship-form-messages";
import { useRelationshipSaveErrorReporter } from "../model/use-relationship-save-error-reporter";
import { RelationshipBookField } from "./relationship-book-field";
import { RelationshipBookStateFields } from "./relationship-book-state-fields";
import { RelationshipFamilyCycleNotice } from "./relationship-family-cycle-notice";
import { RelationshipFormRootError } from "./relationship-form-root-error";
import { RelationshipLabelFields } from "./relationship-label-fields";
import { RelationshipParticipantFields } from "./relationship-participant-fields";
import { RelationshipTypeFields } from "./relationship-type-fields";

const CREATE_STEPS = ["edge", "book"] as const;

type FamilyCycleNotice = {
  overridable: boolean;
  signature: string;
};

type RelationshipCreateFormProps = {
  onCancel: () => void;
  onDraftChange: (draft: RelationshipDraftState) => void;
  onSaved: () => void;
  subject: RelationshipAuthoringSubject;
};

type RelationshipCreateStep = (typeof CREATE_STEPS)[number];

export function RelationshipCreateForm({
  onCancel,
  onDraftChange,
  onSaved,
  subject,
}: RelationshipCreateFormProps) {
  const t = useTranslations("relationships.editor");
  const tToast = useTranslations("relationships.toast");
  const messages = useRelationshipFormMessages();
  const createRelationship = useCreateRelationship();
  const bookStep = toRelationshipCreateBookStep(subject);
  const [step, setStep] = useState<RelationshipCreateStep>("edge");
  const [familyCycle, setFamilyCycle] = useState<Nullable<FamilyCycleNotice>>(null);

  const form = useForm<RelationshipFormInput, unknown, RelationshipFormValues>({
    defaultValues: relationshipCreateDefaults({
      bookId: defaultRelationshipBookId({
        relationship: null,
        scope: subject.scope,
        step: bookStep,
      }),
      focusCharacter: subject.focusCharacter,
    }),
    mode: "onTouched",
    resolver: (values, context, options) =>
      zodResolver(
        buildRelationshipFormSchema({
          messages,
          rules: {
            book: bookStep.kind === "required" ? "required" : "optional",
            participants: "required",
          },
        }),
      )(values, context, options),
  });
  const {
    clearErrors,
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setFocus,
    setValue,
    trigger,
  } = form;
  const [source, target, category, type, customType, bookId] = useWatch({
    control,
    name: ["source", "target", "category", "type", "customType", "bookId"],
  });
  const edgeSignature = toRelationshipEdgeSignature({ category, customType, source, target, type });
  const isFamilyCycleShown = familyCycle !== null && familyCycle.signature === edgeSignature;

  useEffect(() => {
    onDraftChange({ isDirty, isPending: isSubmitting });
  }, [isDirty, isSubmitting, onDraftChange]);

  const reportSaveError = useRelationshipSaveErrorReporter({
    form,
    mode: "create",
    onFamilyCycle: (overridable) => setFamilyCycle({ overridable, signature: edgeSignature }),
    onGone: onCancel,
    revealField: (field) => {
      showStep(stepOf(field));
      return true;
    },
  });

  function showStep(next: RelationshipCreateStep) {
    if (next === step) return;
    flushSync(() => setStep(next));
  }

  async function goToBookStep() {
    const isEdgeValid = await trigger([...RELATIONSHIP_EDGE_FIELDS], { shouldFocus: true });
    if (!isEdgeValid) return;
    showStep("book");
    setFocus(bookStep.kind === "fixed" ? "bookState.description" : "bookId");
  }

  function goToEdgeStep() {
    showStep("edge");
    setFocus(getValues("category") === "custom" ? "customType" : "type");
  }

  function swapParticipants() {
    const [currentSource, currentTarget, sourceLabel, targetLabel] = getValues([
      "source",
      "target",
      "sourceLabel",
      "targetLabel",
    ]);
    setValue("source", currentTarget, { shouldDirty: true });
    setValue("target", currentSource, { shouldDirty: true });
    setValue("sourceLabel", targetLabel, { shouldDirty: true });
    setValue("targetLabel", sourceLabel, { shouldDirty: true });
    clearErrors(["source", "target", "sourceLabel", "targetLabel"]);
  }

  function changeCategory(next: RelationshipCategory) {
    setValue("category", next, { shouldDirty: true });
    setValue("type", next === "custom" ? "custom" : null, { shouldDirty: true });
    clearErrors(["type", "customType"]);
  }

  async function save(
    values: RelationshipFormValues,
    { allowFamilyCycle }: { allowFamilyCycle: boolean },
  ) {
    const { source: savedSource, target: savedTarget } = values;
    if (savedSource === null || savedTarget === null) return;
    try {
      await createRelationship.mutateAsync(
        toCreateRelationshipInput({
          allowFamilyCycle,
          source: savedSource,
          target: savedTarget,
          values,
        }),
      );
      toast.success(tToast("created"));
      onSaved();
    } catch (error) {
      reportSaveError(error);
    }
  }

  function showInvalidStep(fieldErrors: object) {
    const fields = Object.keys(fieldErrors);
    if (fields.some((field) => RELATIONSHIP_EDGE_FIELDS.some((edgeField) => edgeField === field))) {
      showStep("edge");
    }
  }

  const submit = handleSubmit(
    (values) => save(values, { allowFamilyCycle: false }),
    showInvalidStep,
  );
  const submitAllowingFamilyCycle = handleSubmit(
    (values) => save(values, { allowFamilyCycle: true }),
    showInvalidStep,
  );

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        if (step === "edge") {
          event.preventDefault();
          void goToBookStep();
          return;
        }
        void submit(event);
      }}
    >
      <Stepper
        current={CREATE_STEPS.indexOf(step)}
        steps={[{ label: t("steps.edge") }, { label: t("steps.book") }]}
      />
      <div className="-mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1 py-0.5">
        <div className="flex min-w-0 flex-col gap-5" hidden={step !== "edge"}>
          <RelationshipParticipantFields
            control={control}
            errors={errors}
            focusCharacter={subject.focusCharacter}
            onSwap={swapParticipants}
            rosterBookId={relationshipRosterBookId(subject.scope)}
          />
          <RelationshipTypeFields
            control={control}
            customDirectionality={{ kind: "choose" }}
            errors={errors}
            onCategoryChange={changeCategory}
            register={register}
          />
          <RelationshipLabelFields
            defaultOpen={false}
            errors={errors}
            names={{ source: source?.name ?? null, target: target?.name ?? null }}
            register={register}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5" hidden={step !== "book"}>
          <RelationshipBookField
            control={control}
            error={errors.bookId}
            noBookLabel={t("book.none")}
            onBookChange={(next) =>
              setValue("bookId", next, { shouldDirty: true, shouldValidate: true })
            }
            step={bookStep}
          />
          {bookId === null ? (
            <p className="text-sm text-muted-foreground">
              {bookStep.kind === "optional" ? t("book.skipHint") : t("book.requiredHint")}
            </p>
          ) : (
            <RelationshipBookStateFields control={control} errors={errors} register={register} />
          )}
          {isFamilyCycleShown ? (
            <RelationshipFamilyCycleNotice
              isPending={isSubmitting}
              onConfirm={() => void submitAllowingFamilyCycle()}
              overridable={familyCycle.overridable}
            />
          ) : null}
        </div>
        <RelationshipFormRootError message={errors.root?.server?.message} />
      </div>
      <DialogFooter className="shrink-0">
        {step === "edge" ? (
          <>
            <Button key="cancel" onClick={onCancel} type="button" variant="secondary">
              {t("actions.cancel")}
            </Button>
            <Button key="next" type="submit">
              {t("actions.next")}
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={isSubmitting}
              key="back"
              onClick={goToEdgeStep}
              type="button"
              variant="secondary"
            >
              {t("actions.back")}
            </Button>
            <Button disabled={isSubmitting} key="create" loading={isSubmitting} type="submit">
              {t("actions.create")}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}

function stepOf(field: RelationshipFormField): RelationshipCreateStep {
  return isRelationshipEdgeField(field) ? "edge" : "book";
}
