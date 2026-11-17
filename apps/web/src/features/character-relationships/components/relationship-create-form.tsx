"use client";

import { collapseSpaces } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Stepper } from "@/components/ui/stepper";

import type {
  RelationshipAuthoringSubject,
  RelationshipDraftState,
} from "../model/relationship-authoring";
import type { CreateOrientation } from "../model/relationship-create-semantics";
import type {
  RelationshipFormInput,
  RelationshipFormValues,
} from "../model/relationship-form-schema";

import { useCreateRelationship } from "../api/use-create-relationship";
import {
  findRelationshipCreateBookTitle,
  resolveRelationshipCreateBookContext,
  toRelationshipCreateInitialBookId,
} from "../model/relationship-book-step";
import {
  invertCreateOrientation,
  toCreateRelationshipRequest,
  toEffectiveCreateEdgeSignature,
  toRelationshipCreateSemantics,
} from "../model/relationship-create-semantics";
import { CREATE_STEPS } from "../model/relationship-create-step";
import { createRelationshipTypeActions } from "../model/relationship-create-type-actions";
import {
  relationshipCreateDefaults,
  resolveRelationshipDirectionality,
} from "../model/relationship-form-input";
import { buildRelationshipFormSchema } from "../model/relationship-form-schema";
import { useRelationshipCreateBookChange } from "../model/use-relationship-create-book-change";
import { useRelationshipCreateFamilyCycle } from "../model/use-relationship-create-family-cycle";
import { useRelationshipCreateFlow } from "../model/use-relationship-create-flow";
import { useRelationshipFormMessages } from "../model/use-relationship-form-messages";
import { RelationshipBookChangeDialog } from "./relationship-book-change-dialog";
import { RelationshipCreateBookSection } from "./relationship-create-book-section";
import { RelationshipCreateBookStateStep } from "./relationship-create-book-state-step";
import { RelationshipCreateFooter } from "./relationship-create-footer";
import { RelationshipCreateTypeFields } from "./relationship-create-type-fields";
import { RelationshipFamilyCycleNotice } from "./relationship-family-cycle-notice";
import { RelationshipFormRootError } from "./relationship-form-root-error";
import { RelationshipOrientationField } from "./relationship-orientation-field";
import { RelationshipParticipantFields } from "./relationship-participant-fields";
import { RelationshipPreview } from "./relationship-preview";

type RelationshipCreateFormProps = {
  onCancel: () => void;
  onDraftChange: (draft: RelationshipDraftState) => void;
  onSaved: () => void;
  subject: RelationshipAuthoringSubject;
};

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
  const bookContext = resolveRelationshipCreateBookContext(subject);
  const [orientation, setOrientation] = useState<CreateOrientation>("forward");
  const [committedCustomName, setCommittedCustomName] = useState("");

  const form = useForm<RelationshipFormInput, unknown, RelationshipFormValues>({
    defaultValues: relationshipCreateDefaults({
      bookId: toRelationshipCreateInitialBookId(bookContext),
      focusCharacter: subject.focusCharacter,
    }),
    mode: "onTouched",
    resolver: (values, context, options) =>
      zodResolver(
        buildRelationshipFormSchema({
          messages,
          rules: { book: "required", participants: "required" },
        }),
      )({ ...values, customType: collapseSpaces(values.customType) }, context, options),
    shouldFocusError: false,
  });
  const {
    clearErrors,
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = form;
  const [source, target, type, customType, directionality, bookId] = useWatch({
    control,
    name: ["source", "target", "type", "customType", "directionality", "bookId"],
  });
  const effectiveDirectionality = resolveRelationshipDirectionality({ directionality, type });
  const draft = { bookId, customType, directionality, source, target, type };
  const semantics = toRelationshipCreateSemantics({ draft, orientation });
  const announcedSemantics = toRelationshipCreateSemantics({
    draft: { ...draft, customType: committedCustomName },
    orientation,
  });
  const familyCycle = useRelationshipCreateFamilyCycle(toEffectiveCreateEdgeSignature(semantics));
  const { bodyRef, bookStepHeadingRef, edgeStepRef, pairErrorRef, rootErrorRef, ...flow } =
    useRelationshipCreateFlow({
      bookContextKind: bookContext.kind,
      directionality: effectiveDirectionality,
      form,
      onFamilyCycle: familyCycle.report,
      orientation,
    });
  const bookChange = useRelationshipCreateBookChange({
    focusCharacterId: subject.focusCharacter?.id ?? null,
    form,
    onBookChanged: () => {
      setOrientation("forward");
      familyCycle.clear();
      flow.resetSections();
    },
  });
  const typeActions = createRelationshipTypeActions({
    form,
    onOrientationReset: () => setOrientation("forward"),
  });
  const orientationPair =
    type !== null &&
    effectiveDirectionality === "directed" &&
    source !== null &&
    target !== null &&
    source.id !== target.id
      ? { participantA: source, participantB: target }
      : null;
  const isBookBlocked = bookContext.kind === "blocked";
  const isDraftDirty = isDirty || orientation !== "forward";

  useEffect(() => {
    onDraftChange({ isDirty: isDraftDirty, isPending: isSubmitting });
  }, [isDraftDirty, isSubmitting, onDraftChange]);

  function swapParticipants() {
    const [currentSource, currentTarget] = getValues(["source", "target"]);
    setValue("source", currentTarget, { shouldDirty: true });
    setValue("target", currentSource, { shouldDirty: true });
    clearErrors(["source", "target"]);
    flow.clearPairError();
    if (effectiveDirectionality === "directed") setOrientation(invertCreateOrientation);
  }

  async function save(
    values: RelationshipFormValues,
    { allowFamilyCycle }: { allowFamilyCycle: boolean },
  ) {
    const savedSemantics = toRelationshipCreateSemantics({ draft: values, orientation });
    if (savedSemantics === null) return;
    try {
      await createRelationship.mutateAsync(
        toCreateRelationshipRequest({
          allowFamilyCycle,
          bookState: values.bookState,
          semantics: savedSemantics,
        }),
      );
      toast.success(tToast("created"));
      onSaved();
    } catch (error) {
      flow.reportSaveError(error);
    }
  }

  const submit = handleSubmit(
    (values) => save(values, { allowFamilyCycle: false }),
    flow.rejectSubmit,
  );
  const submitAllowingFamilyCycle = handleSubmit(
    (values) => save(values, { allowFamilyCycle: true }),
    flow.rejectSubmit,
  );

  function confirmFamilyCycle() {
    if (isSubmitting || familyCycle.warning === null || !familyCycle.warning.overridable) return;
    void submitAllowingFamilyCycle();
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        if (flow.step === "edge") {
          event.preventDefault();
          if (!isBookBlocked) void flow.goToBookStep();
          return;
        }
        if (!flow.canSubmitBookStep()) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
    >
      <Stepper
        current={CREATE_STEPS.indexOf(flow.step)}
        steps={[{ label: t("steps.edge") }, { label: t("steps.book") }]}
      />
      <div className="-mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1 py-0.5" ref={bodyRef}>
        <div
          className="flex min-w-0 flex-col gap-5"
          hidden={flow.step !== "edge"}
          ref={edgeStepRef}
        >
          <RelationshipCreateBookSection
            context={bookContext}
            control={control}
            error={errors.bookId}
            onBookChange={bookChange.requestBookChange}
          />
          {isBookBlocked ? null : (
            <>
              <RelationshipParticipantFields
                bookId={bookId}
                control={control}
                errors={errors}
                focusCharacter={subject.focusCharacter}
                onParticipantChange={flow.clearPairError}
                onSwap={swapParticipants}
                pairErrorRef={pairErrorRef}
              />
              <RelationshipCreateTypeFields
                control={control}
                errors={errors}
                onCustomDirectionalityChange={typeActions.changeCustomDirectionality}
                onCustomTypeCommit={setCommittedCustomName}
                onCustomTypePick={typeActions.pickCustomType}
                onCustomTypeStart={typeActions.startCustomType}
                onStandardTypeChange={typeActions.selectStandardType}
              />
              {orientationPair === null ? null : (
                <RelationshipOrientationField
                  {...orientationPair}
                  onOrientationChange={setOrientation}
                  orientation={orientation}
                />
              )}
              <RelationshipPreview announcedSemantics={announcedSemantics} semantics={semantics} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5" hidden={flow.step !== "book"}>
          <RelationshipCreateBookStateStep
            bookTitle={findRelationshipCreateBookTitle({ bookId, context: bookContext })}
            control={control}
            errors={errors}
            headingRef={bookStepHeadingRef}
            onSectionOpenChange={flow.setSectionOpen}
            onStatusEnded={flow.openPositions}
            register={register}
            sections={flow.sections}
            semantics={semantics}
          />
          {familyCycle.warning === null ? null : (
            <RelationshipFamilyCycleNotice
              isPending={isSubmitting}
              onConfirm={confirmFamilyCycle}
              overridable={familyCycle.warning.overridable}
            />
          )}
        </div>
        <div className="outline-none" ref={rootErrorRef} tabIndex={-1}>
          <RelationshipFormRootError message={errors.root?.server?.message} />
        </div>
      </div>
      <RelationshipCreateFooter
        isBookBlocked={isBookBlocked}
        isSubmitting={isSubmitting}
        onBack={flow.goToEdgeStep}
        onCancel={onCancel}
        step={flow.step}
      />
      <RelationshipBookChangeDialog {...bookChange.dialog} />
    </form>
  );
}
