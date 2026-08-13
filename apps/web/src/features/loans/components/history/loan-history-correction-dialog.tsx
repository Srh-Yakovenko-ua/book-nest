"use client";

import type { LoanHistoryDetailView } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { isAfter, isBefore, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BookDateField } from "@/features/books/components/book-date-field";
import { ISO_DATE_PATTERN, todayIso } from "@/features/books/model/reading-progress";
import { applyFieldErrors, getErrorMessage } from "@/lib/api-errors";

import { useCorrectLoanHistory } from "../../api/use-correct-loan-history";
import { useLoanHistoryDetail } from "../../api/use-loan-history-detail";

export type LoanHistoryCorrectionMode = "date" | "note";

type LoanHistoryCorrectionDialogProps = {
  loanId: string;
  mode: LoanHistoryCorrectionMode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ReturnedDateMessages = {
  beforeLoanDate: string;
  inFuture: string;
  required: string;
};

const NOTE_MAX = 500;

export function LoanHistoryCorrectionDialog({
  loanId,
  mode,
  onOpenChange,
  open,
}: LoanHistoryCorrectionDialogProps) {
  const t = useTranslations("loans.history.detail");
  const tDate = useTranslations("loans.history.correctDate");
  const tNote = useTranslations("loans.history.editNote");
  const detail = useLoanHistoryDetail(loanId);

  const copy =
    mode === "date"
      ? { description: tDate("description"), title: tDate("title") }
      : { description: tNote("description"), title: tNote("title") };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {detail.isError ? (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-sm text-muted-foreground">{t("error")}</p>
            <Button onClick={() => void detail.refetch()} size="sm" variant="secondary">
              <UiIcon name="refresh" size={16} />
              {t("retry")}
            </Button>
          </div>
        ) : null}

        {detail.isPending ? (
          <div aria-busy className="flex flex-col gap-3" role="status">
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : null}

        {detail.isSuccess ? (
          mode === "date" ? (
            <ReturnedDateForm loan={detail.data} onDone={() => onOpenChange(false)} />
          ) : (
            <NoteForm loan={detail.data} onDone={() => onOpenChange(false)} />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildReturnedDateSchema(messages: ReturnedDateMessages, loanDate: null | string) {
  return z.object({
    returnedDate: z
      .string()
      .refine((value) => ISO_DATE_PATTERN.test(value), messages.required)
      .refine((value) => !isAfter(parseISO(value), parseISO(todayIso())), messages.inFuture)
      .refine(
        (value) => loanDate === null || !isBefore(parseISO(value), parseISO(loanDate)),
        messages.beforeLoanDate,
      ),
  });
}

function NoteForm({ loan, onDone }: { loan: LoanHistoryDetailView; onDone: () => void }) {
  const t = useTranslations("loans.history.editNote");
  const correct = useCorrectLoanHistory();

  const form = useForm<{ note: string }>({
    defaultValues: { note: loan.note ?? "" },
    mode: "onTouched",
    resolver: zodResolver(
      z.object({ note: z.string().max(NOTE_MAX, t("tooLong", { max: NOTE_MAX })) }),
    ),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
    setValue,
  } = form;

  const onSubmit = handleSubmit((values) => {
    const note = values.note.trim();

    correct.mutate(
      { loanId: loan.id, payload: { note: note === "" ? null : note } },
      {
        onError: (error) => {
          if (applyFieldErrors(form, error)) return;
          setError("note", { message: getErrorMessage(error, t("error")) });
        },
        onSuccess: () => {
          toast.success(t("success"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-history-note">{t("label")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note
                    ? "loan-history-note-error loan-history-note-counter"
                    : "loan-history-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="loan-history-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("placeholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="loan-history-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="loan-history-note-counter"
                >
                  {field.value.length}/{NOTE_MAX}
                </span>
              </div>
            </>
          )}
        />
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          onClick={() => setValue("note", "", { shouldDirty: true })}
          type="button"
          variant="ghost"
        >
          {t("clear")}
        </Button>
        <div className="flex gap-2.5">
          <Button onClick={onDone} type="button" variant="secondary">
            {t("cancel")}
          </Button>
          <Button disabled={correct.isPending} loading={correct.isPending} type="submit">
            {t("save")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function ReturnedDateForm({ loan, onDone }: { loan: LoanHistoryDetailView; onDone: () => void }) {
  const t = useTranslations("loans.history.correctDate");
  const correct = useCorrectLoanHistory();

  const form = useForm<{ returnedDate: string }>({
    defaultValues: { returnedDate: loan.returnedDate },
    mode: "onTouched",
    resolver: zodResolver(
      buildReturnedDateSchema(
        {
          beforeLoanDate: t("beforeLoanDate"),
          inFuture: t("inFuture"),
          required: t("required"),
        },
        loan.loanDate,
      ),
    ),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = form;

  const onSubmit = handleSubmit((values) => {
    correct.mutate(
      { loanId: loan.id, payload: { returnedDate: values.returnedDate } },
      {
        onError: (error) => {
          if (applyFieldErrors(form, error)) return;
          setError("returnedDate", { message: getErrorMessage(error, t("error")) });
        },
        onSuccess: () => {
          toast.success(t("success"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-history-returned-date">{t("label")}</Label>
        <Controller
          control={control}
          name="returnedDate"
          render={({ field }) => (
            <BookDateField
              ariaLabel={t("label")}
              describedBy={errors.returnedDate ? "loan-history-returned-date-error" : undefined}
              id="loan-history-returned-date"
              invalid={errors.returnedDate !== undefined}
              onChange={(next) => field.onChange(next ?? "")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.returnedDate} id="loan-history-returned-date-error" />
      </div>

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={correct.isPending} loading={correct.isPending} type="submit">
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
