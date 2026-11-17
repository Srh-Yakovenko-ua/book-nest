"use client";

import type { Nullable, RelationshipDirectionality } from "@app/shared";
import type { UseFormReturn } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { assertNever } from "@/lib/assert-never";

import type { CreateOrientation } from "./relationship-create-semantics";
import type {
  RelationshipCreateBookContextKind,
  RelationshipCreateFocusTarget,
  RelationshipCreateSection,
  RelationshipCreateStep,
} from "./relationship-create-step";
import type {
  RelationshipFormField,
  RelationshipFormInput,
  RelationshipFormValues,
} from "./relationship-form-schema";
import type { RelationshipFieldErrorReason } from "./relationship-save-error";

import { toVisibleCreateParticipantField } from "./relationship-create-semantics";
import {
  CREATE_STEP1_FIELDS,
  hasCreatePositionValues,
  hasCreateSpoilerFlags,
  isCreatePairError,
  planCreateErrorReveal,
  toCreateErrorFields,
} from "./relationship-create-step";
import { focusFirstRelationshipControl } from "./relationship-editor-focus";
import { toRelationshipSaveError } from "./relationship-save-error";

const CREATE_FLOW_ERRORS = {
  pair: "root.pair",
  root: "root.server",
} as const;

type CreateSectionsState = Record<RelationshipCreateSection, boolean> & {
  hasEnteredBookStep: boolean;
};

type UseRelationshipCreateFlowArgs = {
  bookContextKind: RelationshipCreateBookContextKind;
  directionality: RelationshipDirectionality;
  form: UseFormReturn<RelationshipFormInput, unknown, RelationshipFormValues>;
  onFamilyCycle: (overridable: boolean) => void;
  orientation: CreateOrientation;
};

const INITIAL_CREATE_SECTIONS: CreateSectionsState = {
  hasEnteredBookStep: false,
  positions: false,
  spoilers: false,
};

export function useRelationshipCreateFlow({
  bookContextKind,
  directionality,
  form,
  onFamilyCycle,
  orientation,
}: UseRelationshipCreateFlowArgs) {
  const t = useTranslations("relationships.editor.errors");
  const tToast = useTranslations("relationships.toast");
  const [step, setStep] = useState<RelationshipCreateStep>("edge");
  const [sections, setSections] = useState<CreateSectionsState>(INITIAL_CREATE_SECTIONS);
  const [, setFocusRevision] = useState(0);
  const pendingFocus = useRef<Nullable<RelationshipCreateFocusTarget>>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bookStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const edgeStepRef = useRef<HTMLDivElement>(null);
  const isSettlingBookStep = useRef(false);
  const pairErrorRef = useRef<HTMLParagraphElement>(null);
  const rootErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    isSettlingBookStep.current = false;
    switch (target.kind) {
      case "book-step":
        bookStepHeadingRef.current?.focus();
        return;
      case "edge-step":
        focusFirstRelationshipControl(edgeStepRef.current);
        return;
      case "field":
        form.setFocus(target.field);
        return;
      case "pair":
        pairErrorRef.current?.focus();
        return;
      case "root":
        rootErrorRef.current?.focus();
        return;
      default:
        assertNever(target);
    }
  });

  function requestFocus(target: RelationshipCreateFocusTarget) {
    pendingFocus.current = target;
    setFocusRevision((revision) => revision + 1);
  }

  function showStep(next: RelationshipCreateStep) {
    if (next === step) return;
    flushSync(() => setStep(next));
    bodyRef.current?.scrollTo({ top: 0 });
  }

  function openSections(toOpen: readonly RelationshipCreateSection[]) {
    if (toOpen.length === 0) return;
    setSections((current) => ({
      ...current,
      positions: current.positions || toOpen.includes("positions"),
      spoilers: current.spoilers || toOpen.includes("spoilers"),
    }));
  }

  function revealErrors(fields: readonly RelationshipFormField[]) {
    const reveal = planCreateErrorReveal({ bookContextKind, fields });
    if (reveal === null) {
      requestFocus({ kind: "root" });
      return;
    }
    showStep(reveal.step);
    openSections(reveal.sections);
    requestFocus(reveal.focus);
  }

  function collectErrorFields(): RelationshipFormField[] {
    return toCreateErrorFields((field) => form.getFieldState(field).error !== undefined);
  }

  function enterBookStep() {
    isSettlingBookStep.current = true;
    const bookState = form.getValues("bookState");
    setSections((current) =>
      current.hasEnteredBookStep
        ? current
        : {
            hasEnteredBookStep: true,
            positions: current.positions || hasCreatePositionValues(bookState),
            spoilers: current.spoilers || hasCreateSpoilerFlags(bookState),
          },
    );
    showStep("book");
    requestFocus({ kind: "book-step" });
  }

  async function goToBookStep() {
    const isStepValid = await form.trigger(CREATE_STEP1_FIELDS);
    if (!isStepValid) {
      revealErrors(collectErrorFields());
      return;
    }
    form.clearErrors("root");
    enterBookStep();
  }

  function goToEdgeStep() {
    showStep("edge");
    requestFocus({ kind: "edge-step" });
  }

  function reportFieldError({
    field,
    reason,
  }: {
    field: RelationshipFormField;
    reason: RelationshipFieldErrorReason;
  }) {
    const message = reason === "duplicate" ? t("duplicateCreate") : t(reason);
    if (isCreatePairError({ bookContextKind, field, reason })) {
      form.setError(CREATE_FLOW_ERRORS.pair, { message });
      showStep("edge");
      requestFocus({ kind: "pair" });
      return;
    }
    const visibleField = toVisibleCreateParticipantField({ directionality, field, orientation });
    form.setError(visibleField, { message });
    revealErrors([visibleField]);
  }

  function reportInvalidFields(serverFields: readonly RelationshipFormField[]) {
    const fields = serverFields.map((field) =>
      toVisibleCreateParticipantField({ directionality, field, orientation }),
    );
    for (const field of fields) form.setError(field, { message: t("invalidValue") });
    form.setError(CREATE_FLOW_ERRORS.root, { message: t("validation") });
    revealErrors(fields);
  }

  function reportSaveError(error: unknown) {
    const saveError = toRelationshipSaveError(error);
    switch (saveError.kind) {
      case "familyCycle":
        onFamilyCycle(saveError.overridable);
        return;
      case "field":
        reportFieldError(saveError);
        return;
      case "gone":
      case "unknown":
        toast.error(tToast("createError"));
        return;
      case "invalid":
        reportInvalidFields(saveError.fields);
        return;
      default:
        assertNever(saveError);
    }
  }

  return {
    bodyRef,
    bookStepHeadingRef,
    canSubmitBookStep: () => !isSettlingBookStep.current,
    clearPairError: () => form.clearErrors(CREATE_FLOW_ERRORS.pair),
    edgeStepRef,
    goToBookStep,
    goToEdgeStep,
    openPositions: () => openSections(["positions"]),
    pairErrorRef,
    rejectSubmit: () => revealErrors(collectErrorFields()),
    reportSaveError,
    resetSections: () => setSections(INITIAL_CREATE_SECTIONS),
    rootErrorRef,
    sections: { positions: sections.positions, spoilers: sections.spoilers },
    setSectionOpen: (section: RelationshipCreateSection, open: boolean) =>
      setSections((current) =>
        section === "positions" ? { ...current, positions: open } : { ...current, spoilers: open },
      ),
    step,
  };
}
