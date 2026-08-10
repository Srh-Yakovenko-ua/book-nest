"use client";

import type { Nullable, ReadingGoalView } from "@app/shared";
import type { RefObject } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, endOfYear, format, isValid, parse } from "date-fns";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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

import type { GoalFormValues } from "../model/goal-form";

import { useCreateGoal } from "../api/use-create-goal";
import { useUpdateGoal } from "../api/use-update-goal";
import {
  createGoalFormSchema,
  GOAL_FORM,
  goalFormDefaults,
  maxTargetCount,
  toCreateGoalInput,
  toUpdateGoalInput,
} from "../model/goal-form";

const CONFLICT_STATUS = 409;
const CALENDAR_YEAR_SPAN = 10;

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
  { goal: ReadingGoalView; kind: "edit" } | { kind: "create"; listId: string };

type GoalFormDialogProps = {
  bookCount: number;
  listName: Nullable<string>;
  mode: GoalFormMode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
};

export function GoalFormDialog({
  bookCount,
  listName,
  mode,
  onOpenChange,
  open,
  openerRef,
}: GoalFormDialogProps) {
  const t = useTranslations("goals.form");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{mode.kind === "edit" ? t("editTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {listName === null ? null : `${t("source", { name: listName })} · `}
            {t("sourceBooks", { count: bookCount })}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <GoalForm
            bookCount={bookCount}
            listName={listName}
            mode={mode}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  bookCount,
  listName,
  mode,
  onDone,
}: {
  bookCount: number;
  listName: Nullable<string>;
  mode: GoalFormMode;
  onDone: () => void;
}) {
  const t = useTranslations("goals.form");
  const tErrors = useTranslations("goals.form.errors");
  const tToast = useTranslations("goals.toast");
  const weekStartsOn = useWeekStartsOn();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const form = useForm<GoalFormValues, unknown, GoalFormValues>({
    defaultValues: goalFormDefaults({
      bookCount,
      goal: mode.kind === "edit" ? mode.goal : null,
    }),
    mode: "onTouched",
    resolver: zodResolver(
      createGoalFormSchema({
        bookCount,
        messages: {
          deadlinePast: tErrors("deadlinePast"),
          nameMax: tErrors("nameMax", { max: GOAL_FORM.nameMax }),
          required: tErrors("required"),
          targetMax: tErrors("targetMax", { count: bookCount }),
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
  } = form;

  const deadline = useWatch({ control, name: "deadline" });
  const isPending = createGoal.isPending || updateGoal.isPending;
  const isDeadlineBlocked = deadline === "" || errors.deadline !== undefined;
  const now = new Date();

  function reportFailure(error: unknown) {
    if (applyFieldErrors(form, error)) return;
    if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
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
          onSuccess: () => {
            toast.success(tToast("created"));
            onDone();
          },
        },
      );
      return;
    }

    updateGoal.mutate(
      { goalId: mode.goal.id, input: toUpdateGoalInput(values) },
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
          placeholder={listName === null ? undefined : t("namePlaceholder", { name: listName })}
          {...register("name")}
        />
        <FieldError error={errors.name} id={FIELD_ID.nameError} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_ID.targetCount}>{t("targetCount")}</Label>
        <div className="flex flex-wrap items-center gap-3">
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
          <span className="text-xs text-muted-foreground" id={FIELD_ID.targetCountHint}>
            {t("targetHint", { count: bookCount })}
          </span>
        </div>
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
              endMonth={endOfYear(addYears(now, CALENDAR_YEAR_SPAN))}
              id={FIELD_ID.deadline}
              invalid={errors.deadline !== undefined}
              onChange={(date) => field.onChange(date ? format(date, GOAL_FORM.isoDateFormat) : "")}
              placeholder={t("deadlinePlaceholder")}
              startMonth={now}
              value={parseIsoDate(field.value)}
              weekStartsOn={weekStartsOn}
            />
          )}
        />
        <FieldError error={errors.deadline} id={FIELD_ID.deadlineError} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{t("explanation")}</p>

      <DialogFooter>
        <Button disabled={isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isPending || isDeadlineBlocked} loading={isPending} type="submit">
          {mode.kind === "edit" ? t("save") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function parseIsoDate(value: string): Date | undefined {
  if (value === "") return undefined;
  const parsed = parse(value, GOAL_FORM.isoDateFormat, new Date());
  return isValid(parsed) ? parsed : undefined;
}
