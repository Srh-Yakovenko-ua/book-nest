"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";

import { useResendVerification } from "../api/use-resend-verification";
import {
  ResendVerificationFormSchema,
  type ResendVerificationFormValues,
} from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { AuthTextField } from "./auth-text-field";
import { FormBanner } from "./form-banner";

type ResendVerificationFormProps = {
  defaultEmail?: string;
  standalone?: boolean;
};

export function ResendVerificationForm({
  defaultEmail = "",
  standalone = false,
}: ResendVerificationFormProps) {
  const t = useTranslations("auth");
  const resend = useResendVerification();

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ResendVerificationFormValues>({
    defaultValues: { email: defaultEmail },
    mode: "onTouched",
    resolver: zodResolver(ResendVerificationFormSchema),
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    resend.mutate(values);
  });

  const pending = resend.isPending;

  const body = resend.isSuccess ? (
    <FormBanner variant="success">{t("resend.success")}</FormBanner>
  ) : (
    <form noValidate onSubmit={onSubmit}>
      <div className="mb-4">
        <AuthTextField
          aria-describedby={errors.email ? "resend-email-error" : undefined}
          aria-invalid={errors.email !== undefined}
          autoComplete="email"
          error={<AuthFieldError error={errors.email} field="email" id="resend-email-error" />}
          icon="mail"
          id="resend-email"
          invalid={errors.email !== undefined}
          label={t("fields.email")}
          placeholder={t("fields.emailPlaceholder")}
          type="email"
          {...register("email")}
        />
      </div>

      <Button
        className="h-12 w-full rounded-md text-base font-semibold"
        disabled={pending}
        loading={pending}
        type="submit"
      >
        {pending ? t("common.loading") : t("resend.cta")}
      </Button>
    </form>
  );

  if (!standalone) return body;

  return (
    <div className="flex flex-col">
      <AuthHeading subtitle={t("resend.subtitle")} title={t("resend.title")} />
      {body}
    </div>
  );
}
