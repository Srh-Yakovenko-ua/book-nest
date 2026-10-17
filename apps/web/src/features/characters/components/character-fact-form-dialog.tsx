"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { CHARACTER_FACT_ERROR_CODES, CHARACTER_FACT_INPUT_LIMITS } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiscardConfirmDialog } from "@/features/books";
import { useBookPagesCount } from "@/features/books/api/use-book";
import { bookPageCeiling } from "@/features/books/model/book-page-ceiling";
import { applyFieldErrors } from "@/lib/api-errors";
import { ApiError } from "@/lib/http-client";

import type { CharacterFactsScope } from "../api/character-keys";
import type {
  CharacterFactFormInput,
  CharacterFactFormMessages,
  CharacterFactFormTarget,
  CharacterFactFormValues,
} from "../model/character-fact-form-schema";

import { isCharacterFactGone } from "../api/character-fact-mutation-effects";
import { useCreateCharacterFact } from "../api/use-create-character-fact";
import { useUpdateCharacterFact } from "../api/use-update-character-fact";
import { useCharacterFactDraftGuard } from "../hooks/use-character-fact-draft-guard";
import {
  buildCharacterFactFormSchema,
  characterFactFormDefaults,
  toCreateCharacterFactInput,
  toUpdateCharacterFactInput,
} from "../model/character-fact-form-schema";
import { CharacterFactFormFields } from "./character-fact-form-fields";

type CharacterFactFormDialogProps = {
  fallbackFocusRef: RefObject<Nullable<HTMLElement>>;
  onClose: () => void;
  open: boolean;
  returnFocusRef: RefObject<Nullable<HTMLElement>>;
  scope: CharacterFactsScope;
  target: CharacterFactFormTarget;
};

export function CharacterFactFormDialog({
  fallbackFocusRef,
  onClose,
  open,
  returnFocusRef,
  scope,
  target,
}: CharacterFactFormDialogProps) {
  const t = useTranslations("characters.facts.form");
  const tToast = useTranslations("characters.facts.toast");
  const tDiscardChanges = useTranslations("common.discardChanges");
  const createFact = useCreateCharacterFact();
  const updateFact = useUpdateCharacterFact();
  const isEdit = target.mode === "edit";

  const pagesCount = useBookPagesCount(scope.bookId);
  const pageCeiling = bookPageCeiling({
    pagesCount,
    technicalMax: CHARACTER_FACT_INPUT_LIMITS.pageMax,
  });
  const messages: CharacterFactFormMessages = {
    chapterTooLong: t("errors.chapterTooLong", { max: CHARACTER_FACT_INPUT_LIMITS.chapterMax }),
    pageExceedsBook: t("errors.pageExceedsBook", { max: pageCeiling.max }),
    pageNotPositive: t("errors.pageNotPositive"),
    pageTooLarge: t("errors.pageTooLarge"),
    textRequired: t("errors.textRequired"),
    textTooLong: t("errors.textTooLong", { max: CHARACTER_FACT_INPUT_LIMITS.textMax }),
    titleRequired: t("errors.titleRequired"),
    titleTooLong: t("errors.titleTooLong", { max: CHARACTER_FACT_INPUT_LIMITS.titleMax }),
  };

  const form = useForm<CharacterFactFormInput, unknown, CharacterFactFormValues>({
    defaultValues: characterFactFormDefaults(target),
    mode: "onTouched",
    resolver: (values, context, options) =>
      zodResolver(buildCharacterFactFormSchema(messages, pageCeiling))(values, context, options),
  });
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    getFieldState,
    getValues,
    handleSubmit,
    register,
    setError,
    setFocus,
    trigger,
  } = form;

  const guard = useCharacterFactDraftGuard({
    focusFirstField: () => setFocus("title"),
    isDirty,
    isOpen: open,
    isPending: isSubmitting,
    onClose,
  });

  useEffect(() => {
    if (!getFieldState("page").isTouched && getValues("page") === null) return;
    void trigger("page");
  }, [getFieldState, getValues, pageCeiling.max, trigger]);

  function reportSaveError(error: unknown) {
    if (error instanceof ApiError && error.code === CHARACTER_FACT_ERROR_CODES.pageExceedsBook) {
      setError("page", { message: t("errors.pageOutsideBook") }, { shouldFocus: true });
      return;
    }
    if (applyFieldErrors(form, error)) return;
    if (isCharacterFactGone(error)) {
      toast.error(tToast("gone"));
      return;
    }
    toast.error(tToast(isEdit ? "updateError" : "createError"));
  }

  const submit = handleSubmit(async (values) => {
    try {
      if (target.mode === "create") {
        await createFact.mutateAsync({ ...scope, input: toCreateCharacterFactInput(values) });
        toast.success(tToast("created"));
        onClose();
        return;
      }
      const input = toUpdateCharacterFactInput(target.fact, values);
      if (input !== null) {
        await updateFact.mutateAsync({ ...scope, factId: target.fact.id, input });
        toast.success(tToast("updated"));
      }
      onClose();
    } catch (error) {
      reportSaveError(error);
    }
  });

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) guard.requestClose();
        }}
        open={open}
      >
        <DialogContent
          className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            const trigger = returnFocusRef.current;
            const focusTarget = trigger?.isConnected ? trigger : fallbackFocusRef.current;
            if (focusTarget === null || !focusTarget.isConnected) return;
            event.preventDefault();
            focusTarget.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            setFocus("title");
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>
              {isEdit ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              if (isSubmitting) {
                event.preventDefault();
                return;
              }
              void submit(event);
            }}
          >
            <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 py-0.5">
              <CharacterFactFormFields
                bookId={scope.bookId}
                control={control}
                errors={errors}
                pageMax={pageCeiling.max}
                register={register}
              />
            </div>
            <DialogFooter className="shrink-0">
              <Button
                disabled={isSubmitting}
                onClick={guard.requestClose}
                type="button"
                variant="secondary"
              >
                {t("cancel")}
              </Button>
              <Button
                disabled={isSubmitting || (isEdit && !isDirty)}
                loading={isSubmitting}
                type="submit"
              >
                {isEdit ? t("submitEdit") : t("submitCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DiscardConfirmDialog
        cancelLabel={tDiscardChanges("cancel")}
        confirmLabel={tDiscardChanges("confirm")}
        description={t("discard.description")}
        title={t("discard.title")}
        {...guard.discardDialog}
      />
    </>
  );
}
