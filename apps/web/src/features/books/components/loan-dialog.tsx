"use client";

import type {
  BookView,
  CreateLoanInput,
  LoanContactView,
  LoanDirection,
  Nullable,
} from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoanContactPicker } from "@/features/loans/components/loan-contact-picker";

import { useCreateLoan } from "../api/use-loan";
import { toLoanErrorKey } from "../model/loan-error";
import { ISO_DATE_PATTERN, todayIso } from "../model/reading-progress";
import { BookDateField } from "./book-date-field";
import { BookThumb } from "./book-picker";
import { LoanBookStep } from "./loan-book-step";

const NOTE_MAX = 300;

export type LoanDialogContext =
  { book: BookView; kind: "book" } | { contact: LoanContactView; kind: "contact" };

type LoanDialogProps = {
  context: LoanDialogContext;
  direction: LoanDirection;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type LoanFormPerson =
  { contact: LoanContactView; kind: "fixed"; onBack: () => void } | { kind: "pick" };

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

export function LoanDialog({ context, direction, onOpenChange, open }: LoanDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <LoanDialogBody
            context={context}
            direction={direction}
            onDone={() => onOpenChange(false)}
          />
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

function ContactFirstFlow({
  contact,
  direction,
  onDone,
}: {
  contact: LoanContactView;
  direction: LoanDirection;
  onDone: () => void;
}) {
  const [book, setBook] = useState<Nullable<BookView>>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"book" | "form">("book");

  if (step === "form" && book !== null) {
    return (
      <LoanForm
        book={book}
        direction={direction}
        onDone={onDone}
        person={{ contact, kind: "fixed", onBack: () => setStep("book") }}
      />
    );
  }

  return (
    <LoanBookStep
      direction={direction}
      onCancel={onDone}
      onNext={() => setStep("form")}
      onSearchChange={setSearch}
      onSelect={setBook}
      personName={contact.name}
      search={search}
      selectedBookId={book?.id ?? null}
    />
  );
}

function LoanDialogBody({
  context,
  direction,
  onDone,
}: {
  context: LoanDialogContext;
  direction: LoanDirection;
  onDone: () => void;
}) {
  if (context.kind === "contact") {
    return <ContactFirstFlow contact={context.contact} direction={direction} onDone={onDone} />;
  }

  return (
    <LoanForm book={context.book} direction={direction} onDone={onDone} person={{ kind: "pick" }} />
  );
}

function LoanForm({
  book,
  direction,
  onDone,
  person,
}: {
  book: BookView;
  direction: LoanDirection;
  onDone: () => void;
  person: LoanFormPerson;
}) {
  const t = useTranslations("books.details.loan");
  const tErrors = useTranslations("books.details.loan.errors");
  const tActions = useTranslations("books.actions");
  const tContact = useTranslations("loans.contactPicker");
  const createLoan = useCreateLoan();
  const [serverError, setServerError] = useState<null | string>(null);

  const variant = direction === "lent" ? "lent" : "borrowed";
  const fixedContact = person.kind === "fixed" ? person.contact : null;

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<LoanValues>({
    defaultValues: {
      expectedReturnDate: "",
      loanContactId: fixedContact?.id ?? "",
      loanContactName: fixedContact?.name ?? "",
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
        onError: (error) => setServerError(tErrors(toLoanErrorKey(error))),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        {person.kind === "fixed" ? (
          <button
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={person.onBack}
            type="button"
          >
            <UiIcon aria-hidden name="arrow-left" size={16} />
            {t("back")}
          </button>
        ) : null}
        <DialogTitle>{t(`${variant}.title`)}</DialogTitle>
        <DialogDescription>{t(`${variant}.description`)}</DialogDescription>
      </DialogHeader>

      {fixedContact === null ? (
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
      ) : (
        <dl className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{t(`${variant}.personName`)}</dt>
            <dd className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <UiIcon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                name="user"
                size={16}
              />
              <span className="truncate">{fixedContact.name}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{t("fields.book")}</dt>
            <dd className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <BookThumb book={book} />
              <span className="truncate">{book.title}</span>
            </dd>
          </div>
        </dl>
      )}

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
