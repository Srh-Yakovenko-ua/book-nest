"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useRouter } from "@/i18n/navigation";

import { useLogin } from "../api/use-login";
import { useResendVerification } from "../api/use-resend-verification";
import {
  type AuthErrorKey,
  isEmailNotVerified,
  resolveServerError,
} from "../lib/auth-error-messages";
import { safeInternalPath } from "../lib/safe-redirect";
import { LoginFormSchema, type LoginFormValues } from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { AuthSocial } from "./auth-social";
import { AuthTextField } from "./auth-text-field";
import { FormBanner } from "./form-banner";
import { PasswordField } from "./password-field";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const resend = useResendVerification();
  const [formMessageKey, setFormMessageKey] = useState<AuthErrorKey | null>(null);
  const [showResend, setShowResend] = useState(false);

  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "", rememberMe: false },
    mode: "onTouched",
    resolver: zodResolver(LoginFormSchema),
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    setFormMessageKey(null);
    setShowResend(false);

    login.mutate(
      { email: values.email, password: values.password, rememberMe: values.rememberMe ?? false },
      {
        onError: (error) => {
          const resolved = resolveServerError(error);
          for (const fieldError of resolved.fieldErrors) {
            if (fieldError.field === "email") {
              setError("email", { message: t(fieldError.key) });
            }
          }
          setFormMessageKey(resolved.formMessageKey);
          setShowResend(isEmailNotVerified(error));
        },
        onSuccess: () => {
          router.replace(safeInternalPath(searchParams.get("from")) ?? "/");
        },
      },
    );
  });

  const pending = login.isPending;

  return (
    <div className="flex flex-col">
      <AuthHeading subtitle={t("login.subtitle")} title={t("login.title")} />

      {formMessageKey ? (
        <FormBanner className="mb-5" variant="error">
          <span>{t(formMessageKey)}</span>
          {showResend ? (
            <Button
              className="mt-2 h-auto p-0 text-current underline-offset-4"
              disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate({ email: getValues("email") })}
              type="button"
              variant="link"
            >
              {resend.isSuccess ? t("resend.success") : t("resend.cta")}
            </Button>
          ) : null}
        </FormBanner>
      ) : null}

      <form noValidate onSubmit={onSubmit}>
        <div className="mb-4">
          <AuthTextField
            aria-describedby={errors.email ? "login-email-error" : undefined}
            aria-invalid={errors.email !== undefined}
            autoComplete="email"
            error={<AuthFieldError error={errors.email} field="email" id="login-email-error" />}
            icon="mail"
            id="login-email"
            invalid={errors.email !== undefined}
            label={t("fields.email")}
            placeholder={t("fields.emailPlaceholder")}
            type="email"
            {...register("email")}
          />
        </div>

        <div className="mb-4">
          <label
            className="mb-2 flex items-center text-sm leading-tight font-semibold text-foreground"
            htmlFor="login-password"
          >
            {t("fields.password")}
          </label>
          <PasswordField
            aria-describedby={errors.password ? "login-password-error" : undefined}
            aria-invalid={errors.password !== undefined}
            autoComplete="current-password"
            id="login-password"
            invalid={errors.password !== undefined}
            placeholder={t("fields.passwordPlaceholder")}
            {...register("password")}
          />
          <AuthFieldError error={errors.password} field="password" id="login-password-error" />
        </div>

        <div className="mt-1 mb-5 flex items-center justify-between gap-3">
          <Controller
            control={control}
            name="rememberMe"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none">
                <Checkbox
                  checked={field.value === true}
                  className="size-5 rounded-sm"
                  name={field.name}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  ref={field.ref}
                />
                {t("fields.rememberMe")}
              </label>
            )}
          />
          <Link
            className="text-sm font-semibold text-primary hover:underline"
            href="/forgot-password"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>

        <Button
          className="h-12 w-full rounded-md text-base font-semibold"
          disabled={pending}
          loading={pending}
          type="submit"
        >
          {pending ? t("common.loading") : t("login.cta")}
        </Button>
      </form>

      <AuthSocial />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link className="font-semibold text-primary hover:underline" href="/register">
          {t("login.signUp")}
        </Link>
      </p>
    </div>
  );
}
