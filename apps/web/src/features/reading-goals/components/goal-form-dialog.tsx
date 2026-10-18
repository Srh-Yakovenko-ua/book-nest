"use client";

import type { Nullable, ReadingGoalResult, ReadingGoalView } from "@app/shared";
import type { RefObject } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, endOfYear } from "date-fns";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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
import { useWeekStartsOn } from "@/features/settings";
import { applyFieldErrors } from "@/lib/api-errors";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";
import { dateToIsoDay, isoDayToDate } from "@/lib/iso-day";

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
import { GoalDeadlineShortcuts, GoalTargetPresets } from "./goal-form-quick-picks";

const GOAL_FORM_DIALOG = {
  calendarYearSpan: 10,
  conflictStatus: 409,
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
  onCreated?: (goal: ReadingGoalView) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
};

export function GoalFormDialog({
  bookCount,
  listName,
  mode,
  onCreated,
  onOpenChange,
  open,
  openerRef,
}: GoalFormDialogProps) {
  const t = useTranslations("goals.form");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
        onOpenAutoFocus={focusDialogSurface}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 break-words">
            {mode.kind === "edit" ? t("editTitle") : t("title")}
          </DialogTitle>
          <DialogDescription className="break-words">
            {listName === null ? null : `${t("source", { name: listName })} · `}
            {t(BOOK_COUNT_COPY[mode.kind].description, { count: bookCount })}
          </DialogDescription>
        </DialogHeader>
        {mode.kind === "create" && mode.previousOutcome !== null ? (
          <AutoArchiveHint previousOutcome={mode.previousOutcome} />
        ) : null}
        {open ? (
          <GoalForm
            bookCount={bookCount}
            listName={listName}
            mode={mode}
            onCreated={onCreated}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
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
  listName,
  mode,
  onCreated,
  onDone,
}: {
  bookCount: number;
  listName: Nullable<string>;
  mode: GoalFormMode;
  onCreated?: (goal: ReadingGoalView) => void;
  onDone: () => void;
}) {
  const t = useTranslations("goals.form");
  const tErrors = useTranslations("goals.form.errors");
  const tToast = useTranslations("goals.toast");
  const weekStartsOn = useWeekStartsOn();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const copy = BOOK_COUNT_COPY[mode.kind];
  const defaults = goalFormDefaults({
    bookCount,
    goal: mode.kind === "edit" ? mode.goal : null,
  });

  const form = useForm<GoalFormValues, unknown, GoalFormValues>({
    defaultValues: defaults,
    mode: "onTouched",
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
      }),
    ),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = form;

  const [deadline, name, targetCount] = useWatch({
    control,
    name: ["deadline", "name", "targetCount"],
  });
  const isPending = createGoal.isPending || updateGoal.isPending;
  const isDeadlineBlocked = deadline === "" || errors.deadline !== undefined;
  const isUnchanged =
    mode.kind === "edit" &&
    !hasGoalChanges(
      toUpdateGoalInput({ initial: defaults, values: { deadline, name, targetCount } }),
    );
  const now = new Date();

  function reportFailure(error: unknown) {
    if (applyFieldErrors(form, error)) return;
    if (error instanceof ApiError && error.status === GOAL_FORM_DIALOG.conflictStatus) {
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
        <span className="text-xs text-muted-foreground" id={FIELD_ID.targetCountHint}>
          {t(copy.hint, { count: bookCount })}
        </span>
        <FieldError error={errors.targetCount} id={FIELD_ID.targetCountError} />
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
              defaultMonth={now}
              describedBy={errors.deadline ? FIELD_ID.deadlineError : undefined}
              disablePast
              endMonth={endOfYear(addYears(now, GOAL_FORM_DIALOG.calendarYearSpan))}
              id={FIELD_ID.deadline}
              invalid={errors.deadline !== undefined}
              onChange={(date) => field.onChange(date ? dateToIsoDay(date) : "")}
              placeholder={t("deadlinePlaceholder")}
              required
              startMonth={now}
              value={isoDayToDate(field.value)}
              weekStartsOn={weekStartsOn}
            />
          )}
        />
        <GoalDeadlineShortcuts
          onSelect={(value) => setValue("deadline", value, GOAL_FORM_DIALOG.quickPickUpdate)}
          today={now}
          value={deadline}
        />
        <FieldError error={errors.deadline} id={FIELD_ID.deadlineError} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{t("explanation")}</p>

      <DialogFooter>
        <Button disabled={isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={isPending || isDeadlineBlocked || isUnchanged}
          loading={isPending}
          type="submit"
        >
          {mode.kind === "edit" ? t("save") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
