"use client";

import { NicknameSchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isValid, parse } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useNicknameAvailability } from "../api/use-nickname-availability";
import { useRegister } from "../api/use-register";
import { useResendVerification } from "../api/use-resend-verification";
import { type AuthErrorKey, resolveServerError } from "../lib/auth-error-messages";
import { suggestEmailDomain } from "../lib/email-suggestion";
import { RegisterFormSchema, type RegisterFormValues } from "../model/form-schemas";
import { AuthFieldError } from "./auth-field-error";
import { AuthHeading } from "./auth-heading";
import { AuthSocial } from "./auth-social";
import { AuthTextField } from "./auth-text-field";
import { EmailSentPanel } from "./email-sent-panel";
import { FormBanner } from "./form-banner";
import { PasswordChecklist } from "./password-checklist";
import { PasswordField } from "./password-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

const BIRTH_YEAR_SPAN = 120;
const DEFAULT_BIRTH_AGE = 25;

export function RegisterForm() {
  const t = useTranslations("auth");
  const register = useRegister();
  const resend = useResendVerification();
  const [formMessageKey, setFormMessageKey] = useState<AuthErrorKey | null>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register: field,
    setError,
    setValue,
  } = useForm<RegisterFormValues>({
    defaultValues: { confirmPassword: "", email: "", name: "", nickname: "", password: "" },
    mode: "onTouched",
    resolver: zodResolver(RegisterFormSchema),
    reValidateMode: "onChange",
  });

  const password = useWatch({ control, defaultValue: "", name: "password" });
  const email = useWatch({ control, defaultValue: "", name: "email" });
  const nickname = useWatch({ control, defaultValue: "", name: "nickname" });

  const emailSuggestion = suggestEmailDomain(email ?? "");
  const [{ defaultMonth, endMonth, startMonth }] = useState(birthDateBounds);

  const onSubmit = handleSubmit((values) => {
    setFormMessageKey(null);
    const { confirmPassword: _confirmPassword, terms: _terms, ...payload } = values;

    register.mutate(payload, {
      onError: (error) => {
        const resolved = resolveServerError(error);
        for (const fieldError of resolved.fieldErrors) {
          setError(fieldError.field, { message: t(fieldError.key) });
        }
        setFormMessageKey(resolved.formMessageKey);
      },
    });
  });

  if (register.isSuccess) {
    return (
      <div className="flex flex-col">
        <EmailSentPanel
          hint={t("register.checkInboxHint")}
          lead={t("register.verificationSent", { email: register.data.email })}
          onResend={() => resend.mutate({ email: register.data.email })}
          resendPending={resend.isPending}
          title={t("register.checkInbox")}
        />
      </div>
    );
  }

  const pending = register.isPending;

  return (
    <div className="flex flex-col">
      <AuthHeading subtitle={t("register.subtitle")} title={t("register.title")} />

      {formMessageKey ? (
        <FormBanner className="mb-[18px]" variant="error">
          {t(formMessageKey)}
        </FormBanner>
      ) : null}

      <form noValidate onSubmit={onSubmit}>
        <div className="mb-[15px]">
          <AuthTextField
            aria-describedby={errors.name ? "register-name-error" : undefined}
            aria-invalid={errors.name !== undefined}
            autoComplete="name"
            error={<AuthFieldError error={errors.name} field="name" id="register-name-error" />}
            icon="user"
            id="register-name"
            invalid={errors.name !== undefined}
            label={<RequiredLabel>{t("fields.name")}</RequiredLabel>}
            placeholder={t("fields.namePlaceholder")}
            {...field("name")}
          />
        </div>

        <div className="mb-[15px]">
          <AuthTextField
            aria-describedby={errors.email ? "register-email-error" : undefined}
            aria-invalid={errors.email !== undefined}
            autoComplete="email"
            error={<AuthFieldError error={errors.email} field="email" id="register-email-error" />}
            icon="mail"
            id="register-email"
            invalid={errors.email !== undefined}
            label={<RequiredLabel>{t("fields.email")}</RequiredLabel>}
            placeholder={t("fields.emailPlaceholder")}
            status={
              emailSuggestion !== null && errors.email === undefined ? (
                <button
                  className="mt-[7px] w-fit cursor-pointer text-left text-[0.78rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() =>
                    setValue("email", emailSuggestion, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  type="button"
                >
                  {t("register.emailSuggestion", { email: emailSuggestion })}
                </button>
              ) : null
            }
            type="email"
            {...field("email")}
          />
        </div>

        <div className="mb-[15px]">
          <PasswordLabel htmlFor="register-password">
            <RequiredLabel>{t("fields.password")}</RequiredLabel>
          </PasswordLabel>
          <PasswordField
            aria-describedby={errors.password ? "register-password-error" : undefined}
            aria-invalid={errors.password !== undefined}
            autoComplete="new-password"
            id="register-password"
            invalid={errors.password !== undefined}
            placeholder={t("fields.passwordPlaceholder")}
            {...field("password")}
          />
          <PasswordStrengthMeter password={password} />
          <PasswordChecklist password={password} />
          <AuthFieldError error={errors.password} field="password" id="register-password-error" />
        </div>

        <div className="mb-[15px]">
          <PasswordLabel htmlFor="register-confirm">
            <RequiredLabel>{t("fields.confirmPassword")}</RequiredLabel>
          </PasswordLabel>
          <PasswordField
            aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
            aria-invalid={errors.confirmPassword !== undefined}
            autoComplete="new-password"
            id="register-confirm"
            invalid={errors.confirmPassword !== undefined}
            placeholder={t("fields.confirmPasswordPlaceholder")}
            {...field("confirmPassword")}
          />
          <AuthFieldError
            error={errors.confirmPassword}
            field="confirmPassword"
            id="register-confirm-error"
          />
        </div>

        <div className="mb-[15px]">
          <AuthTextField
            aria-describedby={errors.nickname ? "register-nickname-error" : undefined}
            aria-invalid={errors.nickname !== undefined}
            autoComplete="username"
            error={
              errors.nickname ? (
                <AuthFieldError
                  error={errors.nickname}
                  field="nickname"
                  id="register-nickname-error"
                />
              ) : undefined
            }
            hint={t("register.nicknameHint")}
            icon="at"
            id="register-nickname"
            invalid={errors.nickname !== undefined}
            label={t("fields.nickname")}
            optionalLabel={`(${t("common.optional")})`}
            placeholder={t("fields.nicknamePlaceholder")}
            status={errors.nickname ? undefined : <NicknameStatus nickname={nickname ?? ""} />}
            {...field("nickname", {
              setValueAs: (value: string) => (value === "" ? undefined : value),
            })}
          />
        </div>

        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field: dobField }) => (
            <div className="mb-[15px] flex flex-col">
              <label
                className="mb-[7px] flex items-center gap-1.5 text-[0.86rem] leading-tight font-semibold text-foreground"
                htmlFor="register-dob"
              >
                {t("fields.dateOfBirth")}
                <span className="text-[0.78rem] font-medium text-muted-foreground">
                  ({t("common.optional")})
                </span>
              </label>
              <DatePicker
                defaultMonth={defaultMonth}
                describedBy={errors.dateOfBirth ? "register-dob-error" : undefined}
                endMonth={endMonth}
                id="register-dob"
                invalid={errors.dateOfBirth !== undefined}
                onChange={(date) =>
                  dobField.onChange(date ? format(date, "yyyy-MM-dd") : undefined)
                }
                startMonth={startMonth}
                value={parseBirthDate(dobField.value)}
              />
              <AuthFieldError
                error={errors.dateOfBirth}
                field="dateOfBirth"
                id="register-dob-error"
              />
            </div>
          )}
        />

        <Controller
          control={control}
          name="terms"
          render={({ field: termsField }) => (
            <div className="mt-1.5 mb-[15px]">
              <label className="flex cursor-pointer items-start gap-2.5 text-[0.86rem] text-foreground select-none">
                <Checkbox
                  aria-describedby={errors.terms ? "register-terms-error" : undefined}
                  aria-invalid={errors.terms !== undefined}
                  checked={termsField.value === true}
                  className="mt-px size-5 rounded-[6px]"
                  name={termsField.name}
                  onCheckedChange={(checked) => termsField.onChange(checked === true)}
                  ref={termsField.ref}
                />
                {t("fields.terms")}
              </label>
              <AuthFieldError error={errors.terms} field="terms" id="register-terms-error" />
            </div>
          )}
        />

        <Button
          className="h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
          disabled={pending}
          loading={pending}
          type="submit"
        >
          {pending ? t("common.loading") : t("register.cta")}
        </Button>
      </form>

      <AuthSocial />

      <p className="mt-[22px] text-center text-[0.88rem] text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link className="font-semibold text-primary hover:underline" href="/login">
          {t("register.signIn")}
        </Link>
      </p>
    </div>
  );
}

function birthDateBounds(): { defaultMonth: Date; endMonth: Date; startMonth: Date } {
  const now = new Date();
  const currentYear = now.getFullYear();
  return {
    defaultMonth: new Date(currentYear - DEFAULT_BIRTH_AGE, 0),
    endMonth: now,
    startMonth: new Date(currentYear - BIRTH_YEAR_SPAN, 0, 1),
  };
}

function NicknameStatus({ nickname }: { nickname: string }) {
  const t = useTranslations("auth");
  const trimmed = nickname.trim();
  const isValidNickname = NicknameSchema.safeParse(trimmed).success;
  const { data, isLoading } = useNicknameAvailability(nickname);

  if (trimmed === "" || !isValidNickname) return null;

  if (isLoading) {
    return (
      <p className="mt-[7px] flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
        <UiIcon aria-hidden className="animate-spin" name="refresh" size={13} />
        {t("register.nicknameChecking")}
      </p>
    );
  }

  if (data === undefined) return null;

  return (
    <p
      className={cn(
        "mt-[7px] flex items-center gap-1.5 text-[0.78rem]",
        data.available ? "text-success" : "text-destructive",
      )}
    >
      <UiIcon aria-hidden name={data.available ? "check-circle" : "x-circle"} size={13} />
      {data.available ? t("register.nicknameAvailable") : t("errors.nicknameTaken")}
    </p>
  );
}

function parseBirthDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function PasswordLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label
      className="mb-[7px] flex items-center gap-1.5 text-[0.86rem] leading-tight font-semibold text-foreground"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <span aria-hidden className="font-bold text-destructive">
        *
      </span>
    </>
  );
}
