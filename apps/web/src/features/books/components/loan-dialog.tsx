"use client";

import type { BookView, CreateLoanInput, LoanDirection } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoanContactPicker } from "@/features/loans/components/loan-contact-picker";
import { ApiError } from "@/lib/http-client";

import { useCreateLoan } from "../api/use-loan";
import { ISO_DATE_PATTERN, todayIso } from "../model/reading-progress";
import { BookDateField } from "./book-date-field";

const NOTE_MAX = 300;

type LoanDialogProps = {
  book: BookView;
  direction: LoanDirection;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type LoanMessages = {
  contactRequired: string;
  dateInvalid: string;
  loanDateFuture: string;
  noteMax: string;
  reminderNeedsDate: string;
  returnBeforeLoan: string;
};

type LoanValues = {
  expectedReturnDate: string;
  loanContactId: string;
  loanContactName: string;
  loanDate: string;
  note: string;
  remindToReturn: boolean;
};

export function LoanDialog({ book, direction, onOpenChange, open }: LoanDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <LoanForm book={book} direction={direction} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(direction: LoanDirection, values: LoanValues): CreateLoanInput {
  const payload: CreateLoanInput = {
    direction,
    loanContactId: values.loanContactId,
    loanDate: values.loanDate,
  };
  const note = values.note.trim();

  if (values.expectedReturnDate.length > 0) payload.expectedReturnDate = values.expectedReturnDate;
  if (note.length > 0) payload.note = note;
  if (values.remindToReturn) payload.remindToReturn = true;

  return payload;
}

function buildSchema(messages: LoanMessages) {
  return z
    .object({
      expectedReturnDate: z
        .string()
        .refine(
          (value) => value.length === 0 || ISO_DATE_PATTERN.test(value),
          messages.dateInvalid,
        ),
      loanContactId: z.string().min(1, messages.contactRequired),
      loanContactName: z.string(),
      loanDate: z
        .string()
        .refine((value) => ISO_DATE_PATTERN.test(value), messages.dateInvalid)
        .refine((value) => value.length === 0 || value <= todayIso(), messages.loanDateFuture),
      note: z.string().max(NOTE_MAX, messages.noteMax),
      remindToReturn: z.boolean(),
    })
    .refine(
      (value) =>
        value.expectedReturnDate.length === 0 ||
        value.expectedReturnDate >= (value.loanDate.length > 0 ? value.loanDate : todayIso()),
      { message: messages.returnBeforeLoan, path: ["expectedReturnDate"] },
    )
    .refine((value) => !value.remindToReturn || value.expectedReturnDate.length > 0, {
      message: messages.reminderNeedsDate,
      path: ["expectedReturnDate"],
    });
}

function LoanForm({
  book,
  direction,
  onDone,
}: {
  book: BookView;
  direction: LoanDirection;
  onDone: () => void;
}) {
  const t = useTranslations("books.details.loan");
  const tErrors = useTranslations("books.details.loan.errors");
  const tActions = useTranslations("books.actions");
  const tContact = useTranslations("loans.contactPicker");
  const createLoan = useCreateLoan();
  const [serverError, setServerError] = useState<null | string>(null);

  const variant = direction === "lent" ? "lent" : "borrowed";

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<LoanValues>({
    defaultValues: {
      expectedReturnDate: "",
      loanContactId: "",
      loanContactName: "",
      loanDate: todayIso(),
      note: "",
      remindToReturn: false,
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        contactRequired: tContact("required"),
        dateInvalid: tErrors("dateInvalid"),
        loanDateFuture: tErrors("loanDateFuture"),
        noteMax: tErrors("noteMax", { max: NOTE_MAX }),
        reminderNeedsDate: tErrors("reminderNeedsDate"),
        returnBeforeLoan: tErrors("returnBeforeLoan"),
      }),
    ),
  });

  const loanContactId = useWatch({ control, name: "loanContactId" });
  const loanContactName = useWatch({ control, name: "loanContactName" });
  const contactSelection: LoanContactSelection | null =
    loanContactId.length > 0
      ? { contactId: loanContactId, kind: "picked", name: loanContactName }
      : null;

  function handleContactChange(selection: LoanContactSelection | null) {
    setValue("loanContactId", selection?.kind === "picked" ? selection.contactId : "", {
      shouldValidate: true,
    });
    setValue("loanContactName", selection?.name ?? "");
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    createLoan.mutate(
      { id: book.id, payload: buildPayload(direction, values) },
      {
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : tErrors("generic")),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t(`${variant}.title`)}</DialogTitle>
        <DialogDescription>{t(`${variant}.description`)}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-contact-picker">{t(`${variant}.personName`)}</Label>
        <LoanContactPicker
          describedBy={errors.loanContactId ? "loan-contact-picker-error" : undefined}
          id="loan-contact-picker"
          invalid={errors.loanContactId !== undefined}
          label={t(`${variant}.personName`)}
          onChange={handleContactChange}
          placeholder={t(`${variant}.personNamePlaceholder`)}
          value={contactSelection}
        />
        <FieldError error={errors.loanContactId} id="loan-contact-picker-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="loan-date">{t(`${variant}.loanDate`)}</Label>
          <Controller
            control={control}
            name="loanDate"
            render={({ field }) => (
              <BookDateField
                ariaLabel={t(`${variant}.loanDate`)}
                describedBy={errors.loanDate ? "loan-date-error" : undefined}
                id="loan-date"
                invalid={errors.loanDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.loanDate} id="loan-date-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="loan-return-date">{t("fields.returnDate")}</Label>
          <Controller
            control={control}
            name="expectedReturnDate"
            render={({ field }) => (
              <BookDateField
                allowFuture
                ariaLabel={t("fields.returnDate")}
                describedBy={errors.expectedReturnDate ? "loan-return-date-error" : undefined}
                id="loan-return-date"
                invalid={errors.expectedReturnDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("fields.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.expectedReturnDate} id="loan-return-date-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="loan-note">{t("fields.note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note ? "loan-note-error loan-note-counter" : "loan-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="loan-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("fields.notePlaceholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="loan-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="loan-note-counter"
                >
                  {field.value.length}/{NOTE_MAX}
                </span>
              </div>
            </>
          )}
        />
      </div>

      <Controller
        control={control}
        name="remindToReturn"
        render={({ field }) => (
          <label
            className="flex cursor-pointer items-center justify-between gap-3"
            htmlFor="loan-remind"
          >
            <span className="text-sm text-foreground">{t("fields.remindToReturn")}</span>
            <Switch checked={field.value} id="loan-remind" onCheckedChange={field.onChange} />
          </label>
        )}
      />

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={createLoan.isPending} loading={createLoan.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
