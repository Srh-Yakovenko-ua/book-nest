"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { useForgotPassword } from "../api/use-forgot-password";
import { ForgotPasswordFormSchema, type ForgotPasswordFormValues } from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { AuthStepper } from "./auth-stepper";
import { AuthTextField } from "./auth-text-field";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const forgot = useForgotPassword();
  const [cooldown, setCooldown] = useState(0);
  const [sentTo, setSentTo] = useState<null | string>(null);

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

  useEffect(() => {
    if (cooldown <= 0) return;
    const handle = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(handle);
  }, [cooldown]);

  const onSubmit = handleSubmit((values) => {
    forgot.mutate(values, {
      onSettled: () => {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setSentTo(values.email);
      },
    });
  });

  const pending = forgot.isPending;
  const onEmailStep = sentTo !== null;
  const steps = [
    { id: "request", label: t("stepper.request") },
    { id: "email", label: t("stepper.email") },
  ] as const;

  const resendLabel =
    cooldown > 0 ? t("forgot.resendIn", { seconds: cooldown }) : t("forgot.resend");

  return (
    <div className="flex flex-col">
      <AuthStepper
        ariaLabel={t("stepper.label")}
        current={onEmailStep ? 1 : 0}
        onStepSelect={onEmailStep ? () => setSentTo(null) : undefined}
        steps={steps}
      />

      {onEmailStep ? (
        <div>
          <span
            aria-hidden
            className="mb-[18px] grid size-16 place-items-center rounded-full bg-accent text-primary"
          >
            <UiIcon name="mail" size={28} />
          </span>

          <AuthHeading
            subtitle={t("forgot.sentLead", { email: sentTo })}
            title={t("forgot.sentTitle")}
          />

          <Button
            className="h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
            disabled={pending || cooldown > 0}
            loading={pending}
            onClick={onSubmit}
            type="button"
          >
            {pending ? t("common.loading") : resendLabel}
          </Button>

          <p className="mt-[18px] text-center text-[0.88rem] text-muted-foreground">
            {t("forgot.sentHint")}
          </p>

          <p className="mt-[22px] text-center text-[0.88rem]">
            <Link
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              href="/login"
            >
              <UiIcon aria-hidden name="arrow-left" size={16} />
              {t("forgot.backToSignIn")}
            </Link>
          </p>
        </div>
      ) : (
        <div>
          <AuthHeading subtitle={t("forgot.subtitle")} title={t("forgot.title")} />

          <form noValidate onSubmit={onSubmit}>
            <div className="mb-[15px]">
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
                type="email"
                {...register("email")}
              />
            </div>

            <Button
              className="h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
              disabled={pending}
              loading={pending}
              type="submit"
            >
              {pending ? t("common.loading") : t("forgot.cta")}
            </Button>
          </form>

          <p className="mt-[22px] text-center text-[0.88rem] text-muted-foreground">
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
