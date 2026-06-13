import {
  ForgotPasswordInputSchema,
  LoginInputSchema,
  PasswordSchema,
  RegistrationInputSchema,
  ResendVerificationSchema,
} from "@app/shared";
import { z } from "zod";

export const PASSWORD_MISMATCH_KEY = "errors.passwordMismatch";
export const TERMS_REQUIRED_KEY = "errors.termsRequired";
export const AGE_TOO_YOUNG_KEY = "errors.ageTooYoung";

const MIN_AGE = 13;
const EARLIEST_BIRTH_YEAR = 1900;

export const LoginFormSchema = LoginInputSchema;

export type LoginFormValues = z.input<typeof LoginFormSchema>;

function isValidBirthDate(value: string | undefined): boolean {
  if (value === undefined || value === "") return true;

  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  if (birth.getFullYear() < EARLIEST_BIRTH_YEAR) return false;

  const now = new Date();
  if (birth.getTime() > now.getTime()) return false;

  const thirteenthBirthday = new Date(birth);
  thirteenthBirthday.setFullYear(thirteenthBirthday.getFullYear() + MIN_AGE);
  return thirteenthBirthday.getTime() <= now.getTime();
}

export const RegisterFormSchema = RegistrationInputSchema.extend({
  confirmPassword: z.string(),
  terms: z.literal(true, TERMS_REQUIRED_KEY),
})
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORD_MISMATCH_KEY,
    path: ["confirmPassword"],
  })
  .refine((values) => isValidBirthDate(values.dateOfBirth), {
    message: AGE_TOO_YOUNG_KEY,
    path: ["dateOfBirth"],
  });

export type RegisterFormValues = z.input<typeof RegisterFormSchema>;

export const ResetPasswordFormSchema = z
  .object({
    confirmPassword: z.string(),
    password: PasswordSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORD_MISMATCH_KEY,
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.input<typeof ResetPasswordFormSchema>;

export const ForgotPasswordFormSchema = ForgotPasswordInputSchema;

export type ForgotPasswordFormValues = z.input<typeof ForgotPasswordFormSchema>;

export const ResendVerificationFormSchema = ResendVerificationSchema;

export type ResendVerificationFormValues = z.input<typeof ResendVerificationFormSchema>;
