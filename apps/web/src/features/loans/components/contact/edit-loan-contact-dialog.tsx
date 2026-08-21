"use client";

import type { LoanContactView } from "@app/shared";

import { CreateLoanContactInputSchema, LOAN_CONTACT_ERROR_CODES } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyFieldErrors } from "@/lib/api-errors";
import { ApiError } from "@/lib/http-client";

import { useUpdateLoanContact } from "../../api/use-update-loan-contact";

type EditLoanContactDialogProps = {
  contact: LoanContactView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type EditLoanContactValues = {
  contact: string;
  name: string;
};

const CONTACT_FIELDS = CreateLoanContactInputSchema.shape;

export function EditLoanContactDialog({ contact, onOpenChange, open }: EditLoanContactDialogProps) {
  const t = useTranslations("loans.contactDrawer.edit");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditLoanContactForm
            contact={contact}
            onCancel={() => onOpenChange(false)}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildSchema(messages: { contactInvalid: string; nameInvalid: string }) {
  return z.object({
    contact: z
      .string()
      .refine(
        (value) => value.trim() === "" || CONTACT_FIELDS.contact.safeParse(value).success,
        messages.contactInvalid,
      ),
    name: z.string().refine((value) => CONTACT_FIELDS.name.safeParse(value).success, {
      message: messages.nameInvalid,
    }),
  });
}

function EditLoanContactForm({
  contact,
  onCancel,
  onDone,
}: {
  contact: LoanContactView;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("loans.contactDrawer.edit");
  const updateContact = useUpdateLoanContact();
  const [serverError, setServerError] = useState<null | string>(null);

  const form = useForm<EditLoanContactValues>({
    defaultValues: { contact: contact.contact ?? "", name: contact.name },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        contactInvalid: t("errors.contactInvalid"),
        nameInvalid: t("errors.nameInvalid"),
      }),
    ),
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = form;

  function handleError(error: unknown): void {
    if (error instanceof ApiError && error.code === LOAN_CONTACT_ERROR_CODES.duplicateName) {
      setError("name", { message: t("errors.duplicateName") });
      return;
    }
    if (error instanceof ApiError && error.code === LOAN_CONTACT_ERROR_CODES.archivedName) {
      setError("name", { message: t("errors.archivedName") });
      return;
    }
    if (applyFieldErrors(form, error)) return;
    setServerError(t("errors.generic"));
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const nextContact = values.contact.trim();

    updateContact.mutate(
      {
        contactId: contact.id,
        payload: { contact: nextContact === "" ? null : nextContact, name: values.name.trim() },
      },
      {
        onError: handleError,
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
        <Label htmlFor="edit-loan-contact-name">{t("name")}</Label>
        <Input
          aria-describedby={errors.name ? "edit-loan-contact-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-loan-contact-name"
          placeholder={t("namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="edit-loan-contact-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-loan-contact-contact">
          {t("contact")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          aria-describedby={errors.contact ? "edit-loan-contact-contact-error" : undefined}
          aria-invalid={errors.contact !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-loan-contact-contact"
          placeholder={t("contactPlaceholder")}
          {...register("contact")}
        />
        <FieldError error={errors.contact} id="edit-loan-contact-contact-error" />
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={updateContact.isPending} loading={updateContact.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
