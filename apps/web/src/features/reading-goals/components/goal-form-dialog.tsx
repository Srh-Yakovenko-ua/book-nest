"use client";

import type { Nullable, ReadingGoalResult, ReadingGoalView } from "@app/shared";
import type { RefObject } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, addYears, endOfYear, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfileTimeZone, useWeekStartsOn } from "@/features/settings";
import { useCloseGuard } from "@/hooks/use-close-guard";
import { applyFieldErrors, HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { dateToIsoDay, isoDayToDate, todayIsoDay } from "@/lib/iso-day";

import type { GoalFormValues } from "../model/goal-form";

import { useCreateGoal } from "../api/use-create-goal";
import { useUpdateGoal } from "../api/use-update-goal";
import {
  createGoalFormSchema,
  GOAL_FORM,
  goalFormDefaults,
  hasGoalChanges,
  maxTargetCount,
  toCreateGoalInput,
  toUpdateGoalInput,
} from "../model/goal-form";
import { GoalCreationPreview } from "./goal-creation-preview";
import { GoalDeadlineShortcuts, GoalTargetPresets } from "./goal-form-quick-picks";

const GOAL_FORM_DIALOG = {
  calendarYearSpan: 10,
  quickPickUpdate: { shouldDirty: true, shouldTouch: true, shouldValidate: true },
} as const;

const FIELD_ID = {
  deadline: "goal-form-deadline",
  deadlineError: "goal-form-deadline-error",
  name: "goal-form-name",
  nameError: "goal-form-name-error",
  targetCount: "goal-form-target-count",
  targetCountError: "goal-form-target-count-error",
  targetCountHint: "goal-form-target-count-hint",
} as const;

export type GoalFormMode =
  | { goal: ReadingGoalView; kind: "edit" }
  | { kind: "create"; listId: string; previousOutcome: Nullable<ReadingGoalResult> };

const BOOK_COUNT_COPY = {
  create: {
    description: "sourceBooks",
    hint: "targetHint",
    targetMax: "errors.targetMax",
  },
  edit: {
    description: "snapshotBooks",
    hint: "snapshotHint",
    targetMax: "errors.snapshotTargetMax",
  },
} as const satisfies Record<GoalFormMode["kind"], Record<string, string>>;

type GoalFormDialogProps = {
  bookCount: number;
  listName: Nullable<string>;
  mode: GoalFormMode;
  onChangeList?: () => void;
  onCreated?: (goal: ReadingGoalView) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
};

type GoalFormExit = "changeList" | "close";

export function GoalFormDialog({
  bookCount,
  listName,
  mode,
  onChangeList,
  onCreated,
  onOpenChange,
  open,
  openerRef,
}: GoalFormDialogProps) {
  const t = useTranslations("goals.form");
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const isPending = createGoal.isPending || updateGoal.isPending;
  const [isDraftDirty, setDraftDirty] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<GoalFormExit>("close");

  function leave() {
    if (exitRef.current === "changeList" && onChangeList !== undefined) {
      onChangeList();
      return;
    }
    onOpenChange(false);
  }

  const guard = useCloseGuard({
    focusFallback: () => contentRef.current?.focus(),
    isDirty: isDraftDirty,
    isOpen: open,
    isPending,
    onClose: leave,
  });

  function requestExit(exit: GoalFormExit) {
    exitRef.current = exit;
    guard.requestClose();
  }

  function closeAfterSave() {
    exitRef.current = "close";
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) requestExit("close");
        }}
        open={open}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (exitRef.current === "changeList") return;
            openerRef.current?.focus();
          }}
          onOpenAutoFocus={focusDialogSurface}
          ref={contentRef}
        >
          <DialogHeader>
            <DialogTitle className="pr-8 break-words">
              {mode.kind === "edit" ? t("editTitle") : t("title")}
            </DialogTitle>
            <DialogDescription className="break-words">
              {listName === null ? null : `${t("source", { name: listName })} · `}
              {t(BOOK_COUNT_COPY[mode.kind].description, { count: bookCount })}
            </DialogDescription>
            {onChangeList === undefined ? null : (
              <Button
                className="-ml-2.5 self-start"
                disabled={isPending}
                onClick={() => requestExit("changeList")}
                type="button"
                variant="ghost"
              >
                <UiIcon aria-hidden name="arrow-left" size={14} />
                {t("changeList")}
              </Button>
            )}
          </DialogHeader>
          {mode.kind === "create" && mode.previousOutcome !== null ? (
            <AutoArchiveHint previousOutcome={mode.previousOutcome} />
          ) : null}
          {open ? (
            <GoalForm
              bookCount={bookCount}
              createGoal={createGoal}
              listName={listName}
              mode={mode}
              onCancel={() => requestExit("close")}
              onCreated={onCreated}
              onDirtyChange={setDraftDirty}
              onDone={closeAfterSave}
              updateGoal={updateGoal}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog {...guard.discardDialog} />
    </>
  );
}

function AutoArchiveHint({ previousOutcome }: { previousOutcome: ReadingGoalResult }) {
  const t = useTranslations("goals.form");

  return (
    <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs leading-relaxed text-info">
      <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
      <span>{t(`autoArchive.${previousOutcome}`)}</span>
    </p>
  );
}

function focusDialogSurface(event: Event) {
  event.preventDefault();
  if (!(event.currentTarget instanceof HTMLElement)) return;
  event.currentTarget.focus();
}

function GoalForm({
  bookCount,
  createGoal,
  listName,
  mode,
  onCancel,
  onCreated,
  onDirtyChange,
  onDone,
  updateGoal,
}: {
  bookCount: number;
  createGoal: ReturnType<typeof useCreateGoal>;
  listName: Nullable<string>;
  mode: GoalFormMode;
  onCancel: () => void;
  onCreated?: (goal: ReadingGoalView) => void;
  onDirtyChange: (isDirty: boolean) => void;
  onDone: () => void;
  updateGoal: ReturnType<typeof useUpdateGoal>;
}) {
  const t = useTranslations("goals.form");
  const tErrors = useTranslations("goals.form.errors");
  const tToast = useTranslations("goals.toast");
  const weekStartsOn = useWeekStartsOn();
  const today = todayIsoDay(useProfileTimeZone());
  const copy = BOOK_COUNT_COPY[mode.kind];
  const defaults = goalFormDefaults({
    bookCount,
    goal: mode.kind === "edit" ? mode.goal : null,
  });

  const form = useForm<GoalFormValues, unknown, GoalFormValues>({
    defaultValues: defaults,
    mode: "onChange",
    resolver: zodResolver(
      createGoalFormSchema({
        bookCount,
        initialDeadline: defaults.deadline,
        messages: {
          deadlinePast: tErrors("deadlinePast"),
          nameMax: tErrors("nameMax", { max: GOAL_FORM.nameMax }),
          required: tErrors("required"),
          targetMax:
            bookCount > GOAL_FORM.maxTargetCount
              ? tErrors("targetCap", { count: GOAL_FORM.maxTargetCount })
              : t(copy.targetMax, { count: bookCount }),
          targetMin: tErrors("targetMin"),
        },
        today,
      }),
    ),
  });

  const {
    control,
    formState: { errors, isDirty, isValid },
    handleSubmit,
    register,
    setValue,
  } = form;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const [deadline, name, targetCount] = useWatch({
    control,
    name: ["deadline", "name", "targetCount"],
  });
  const isPending = createGoal.isPending || updateGoal.isPending;
  const isUnchanged =
    mode.kind === "edit" &&
    !hasGoalChanges(
      toUpdateGoalInput({ initial: defaults, values: { deadline, name, targetCount } }),
    );
  const todayDate = parseISO(today);
  const explanation = (
    <p className="text-xs leading-relaxed text-muted-foreground">{t("explanation")}</p>
  );

  function reportFailure(error: unknown) {
    if (applyFieldErrors(form, error)) return;
    if (isApiErrorStatus(error, HTTP_STATUS.conflict)) {
      toast.error(tToast("conflict"));
      return;
    }
    toast.error(tToast("error"));
  }

  const onSubmit = handleSubmit((values) => {
    if (mode.kind === "create") {
      createGoal.mutate(
        { input: toCreateGoalInput(values), listId: mode.listId },
        {
          onError: reportFailure,
          onSuccess: (goal) => {
            toast.success(tToast("created"));
            onDone();
            onCreated?.(goal);
          },
        },
      );
      return;
    }

    const input = toUpdateGoalInput({ initial: defaults, values });
    if (!hasGoalChanges(input)) return;

    updateGoal.mutate(
      { goalId: mode.goal.id, input },
      {
        onError: reportFailure,
        onSuccess: () => {
          toast.success(tToast("updated"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_ID.name}>
          {t("name")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("nameOptional")}</span>
        </Label>
        <Input
          aria-describedby={errors.name ? FIELD_ID.nameError : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id={FIELD_ID.name}
          maxLength={GOAL_FORM.nameMax}
          placeholder={
            listName === null
              ? t("namePlaceholderGeneric")
              : t("namePlaceholder", { name: listName })
          }
          {...register("name")}
        />
        <FieldError error={errors.name} id={FIELD_ID.nameError} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_ID.targetCount}>{t("targetCount")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Controller
            control={control}
            name="targetCount"
            render={({ field }) => (
              <Input
                aria-describedby={
                  errors.targetCount ? FIELD_ID.targetCountError : FIELD_ID.targetCountHint
                }
                aria-invalid={errors.targetCount !== undefined}
                aria-required
                autoComplete="off"
                className="h-10 w-24"
                id={FIELD_ID.targetCount}
                inputMode="numeric"
                max={maxTargetCount(bookCount)}
                min={GOAL_FORM.minTargetCount}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(
                    event.target.value === "" ? Number.NaN : Number(event.target.value),
                  )
                }
                onKeyDown={blockNegativeNumberKeys}
                onPaste={blockNegativeNumberPaste}
                ref={field.ref}
                step={1}
                type="number"
                value={Number.isNaN(field.value) ? "" : field.value}
              />
            )}
          />
          <GoalTargetPresets
            bookCount={bookCount}
            onSelect={(value) => setValue("targetCount", value, GOAL_FORM_DIALOG.quickPickUpdate)}
            value={targetCount}
          />
        </div>
        {errors.targetCount ? (
          <FieldError error={errors.targetCount} id={FIELD_ID.targetCountError} />
        ) : (
          <span className="text-xs text-muted-foreground" id={FIELD_ID.targetCountHint}>
            {t(copy.hint, { count: bookCount })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_ID.deadline}>{t("deadline")}</Label>
        <Controller
          control={control}
          name="deadline"
          render={({ field }) => (
            <DatePicker
              allowFuture
              ariaLabel={t("deadline")}
              className="h-10"
              defaultMonth={todayDate}
              describedBy={errors.deadline ? FIELD_ID.deadlineError : undefined}
              earliestDay={addDays(todayDate, 1)}
              endMonth={endOfYear(addYears(todayDate, GOAL_FORM_DIALOG.calendarYearSpan))}
              id={FIELD_ID.deadline}
              invalid={errors.deadline !== undefined}
              onChange={(date) => field.onChange(date ? dateToIsoDay(date) : "")}
              placeholder={t("deadlinePlaceholder")}
              required
              startMonth={todayDate}
              today={todayDate}
              value={isoDayToDate(field.value)}
              weekStartsOn={weekStartsOn}
            />
          )}
        />
        <GoalDeadlineShortcuts
          onSelect={(value) => setValue("deadline", value, GOAL_FORM_DIALOG.quickPickUpdate)}
          today={todayDate}
          value={deadline}
        />
        <FieldError error={errors.deadline} id={FIELD_ID.deadlineError} />
      </div>

      {mode.kind === "create" ? (
        <GoalCreationPreview
          deadline={deadline}
          listId={mode.listId}
          targetCount={targetCount}
          today={today}
        >
          {explanation}
        </GoalCreationPreview>
      ) : (
        explanation
      )}

      <DialogFooter>
        <Button disabled={isPending} onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={!isValid || isPending || isUnchanged} loading={isPending} type="submit">
          {mode.kind === "edit" ? t("save") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
