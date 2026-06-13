"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { useResetPassword } from "../api/use-reset-password";
import { isInvalidToken } from "../lib/auth-error-messages";
import { ResetPasswordFormSchema, type ResetPasswordFormValues } from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { FormBanner } from "./form-banner";
import { PasswordChecklist } from "./password-checklist";
import { PasswordField } from "./password-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("auth");
  const reset = useResetPassword();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { confirmPassword: "", password: "" },
    mode: "onTouched",
    resolver: zodResolver(ResetPasswordFormSchema),
    reValidateMode: "onChange",
  });

  const password = useWatch({ control, defaultValue: "", name: "password" });

  const [tokenInvalid, setTokenInvalid] = useState(token.trim() === "");

  useEffect(() => {
    if (token.length === 0) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [token]);

  const onSubmit = handleSubmit((values) => {
    reset.mutate(
      { password: values.password, token },
      {
        onError: (error) => {
          if (isInvalidToken(error)) setTokenInvalid(true);
        },
      },
    );
  });

  if (tokenInvalid) {
    return (
      <div className="flex flex-col">
        <AuthHeading title={t("reset.title")} />
        <FormBanner className="mt-6" variant="error">
          {t("errors.invalidToken")}
        </FormBanner>
        <Button
          asChild
          className="mt-6 h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
          variant="secondary"
        >
          <Link href="/forgot-password">{t("reset.requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  if (reset.isSuccess) {
    return (
      <div className="flex flex-col">
        <AuthHeading title={t("reset.title")} />
        <FormBanner className="mt-6" variant="success">
          {t("reset.success")}
        </FormBanner>
        <Button
          asChild
          className="mt-6 h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
        >
          <Link href="/login">{t("reset.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  const pending = reset.isPending;

  return (
    <div className="flex flex-col">
      <AuthHeading subtitle={t("reset.subtitle")} title={t("reset.title")} />

      <form noValidate onSubmit={onSubmit}>
        <div className="mb-[15px]">
          <label
            className="mb-[7px] flex items-center text-[0.86rem] leading-tight font-semibold text-foreground"
            htmlFor="reset-password"
          >
            {t("fields.newPassword")}
          </label>
          <PasswordField
            aria-describedby={errors.password ? "reset-password-error" : undefined}
            aria-invalid={errors.password !== undefined}
            autoComplete="new-password"
            icon="key"
            id="reset-password"
            invalid={errors.password !== undefined}
            placeholder={t("fields.newPasswordPlaceholder")}
            {...register("password")}
          />
          <PasswordStrengthMeter password={password} />
          <PasswordChecklist password={password} />
          <AuthFieldError error={errors.password} field="password" id="reset-password-error" />
        </div>

        <div className="mb-[15px]">
          <label
            className="mb-[7px] flex items-center text-[0.86rem] leading-tight font-semibold text-foreground"
            htmlFor="reset-confirm"
          >
            {t("fields.confirmPassword")}
          </label>
          <PasswordField
            aria-describedby={errors.confirmPassword ? "reset-confirm-error" : undefined}
            aria-invalid={errors.confirmPassword !== undefined}
            autoComplete="new-password"
            id="reset-confirm"
            invalid={errors.confirmPassword !== undefined}
            placeholder={t("fields.confirmPasswordPlaceholder")}
            {...register("confirmPassword")}
          />
          <AuthFieldError
            error={errors.confirmPassword}
            field="confirmPassword"
            id="reset-confirm-error"
          />
        </div>

        <Button
          className="h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
          disabled={pending}
          loading={pending}
          type="submit"
        >
          {pending ? t("common.loading") : t("reset.cta")}
        </Button>
      </form>

      <p className="mt-[22px] text-center text-[0.88rem] text-muted-foreground">
        <Link className="font-semibold text-primary hover:underline" href="/login">
          {t("reset.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
