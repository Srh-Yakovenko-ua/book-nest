"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { useForgotPassword } from "../api/use-forgot-password";
import { resolveServerError } from "../lib/auth-error-messages";
import { DEFAULT_RESEND_COOLDOWN_SECONDS } from "../lib/resend-cooldown";
import { ForgotPasswordFormSchema, type ForgotPasswordFormValues } from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { AuthStepper } from "./auth-stepper";
import { AuthTextField } from "./auth-text-field";
import { EmailSentPanel } from "./email-sent-panel";
import { FormBanner } from "./form-banner";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<null | string>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const returnedToRequestStep = useRef(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: { email: "" },
    mode: "onTouched",
    resolver: zodResolver(ForgotPasswordFormSchema),
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    forgot.mutate(values, {
      onSuccess: () => setSentTo(values.email),
    });
  });

  const backToRequestStep = () => {
    setSentTo(null);
    forgot.reset();
    returnedToRequestStep.current = true;
  };

  const pending = forgot.isPending;
  const onEmailStep = sentTo !== null;

  useEffect(() => {
    if (onEmailStep) return;
    if (!returnedToRequestStep.current) return;
    returnedToRequestStep.current = false;
    emailInputRef.current?.focus();
  }, [onEmailStep]);

  const { ref: registerEmailRef, ...emailField } = register("email");
  const formMessageKey = forgot.isError ? resolveServerError(forgot.error).formMessageKey : null;
  const steps = [
    { id: "request", label: t("stepper.request") },
    { id: "email", label: t("stepper.email") },
  ] as const;

  return (
    <div className="flex flex-col">
      <AuthStepper
        ariaLabel={t("stepper.label")}
        current={onEmailStep ? 1 : 0}
        onStepSelect={onEmailStep ? backToRequestStep : undefined}
        steps={steps}
      />

      {onEmailStep ? (
        <EmailSentPanel
          cooldownSeconds={forgot.data?.cooldownSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS}
          hint={t("forgot.sentHint")}
          lead={t("forgot.sentLead", { email: sentTo })}
          onResend={onSubmit}
          resendPending={pending}
          title={t("forgot.sentTitle")}
        />
      ) : (
        <div>
          <AuthHeading subtitle={t("forgot.subtitle")} title={t("forgot.title")} />

          {formMessageKey ? (
            <FormBanner className="mb-5" variant="error">
              {t(formMessageKey)}
            </FormBanner>
          ) : null}

          <form noValidate onSubmit={onSubmit}>
            <div className="mb-4">
              <AuthTextField
                aria-describedby={errors.email ? "forgot-email-error" : undefined}
                aria-invalid={errors.email !== undefined}
                autoComplete="email"
                error={
                  <AuthFieldError error={errors.email} field="email" id="forgot-email-error" />
                }
                icon="mail"
                id="forgot-email"
                invalid={errors.email !== undefined}
                label={t("fields.email")}
                placeholder={t("fields.emailPlaceholder")}
                ref={(node) => {
                  registerEmailRef(node);
                  emailInputRef.current = node;
                }}
                type="email"
                {...emailField}
              />
            </div>

            <Button
              className="h-12 w-full rounded-md text-base font-semibold"
              disabled={pending}
              loading={pending}
              type="submit"
            >
              {pending ? t("common.loading") : t("forgot.cta")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("forgot.rememberPrompt")}{" "}
            <Link className="font-semibold text-primary hover:underline" href="/login">
              {t("forgot.backToLogin")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
