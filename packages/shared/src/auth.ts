import { z } from "zod";

const NAME_MIN = 2;
const NAME_MAX = 50;
const NAME_ALLOWED = /^[\p{L}\p{M} '’-]+$/u;
const NAME_HAS_LETTER = /\p{L}/u;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_LOWERCASE = /[a-z]/;
const PASSWORD_DIGIT = /[0-9]/;
const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;
const NICKNAME_MIN = 3;
const NICKNAME_MAX = 20;
const NICKNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const NICKNAME_EDGES = /^[A-Za-z0-9].*[A-Za-z0-9]$/;
const NICKNAME_NO_REPEAT = /^(?!.*(?:\.\.|__))/;

export const NicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, "Nickname must be at least 3 characters long")
  .max(NICKNAME_MAX, "Nickname must be at most 20 characters long")
  .regex(NICKNAME_PATTERN, "Nickname may contain only Latin letters, digits, underscore and dot")
  .regex(NICKNAME_EDGES, "Nickname must start and end with a letter or digit")
  .regex(NICKNAME_NO_REPEAT, "Nickname must not contain consecutive dots or underscores");

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "Password must be at least 8 characters long")
  .max(PASSWORD_MAX, "Password must be at most 128 characters long")
  .regex(PASSWORD_UPPERCASE, "Password must contain at least one uppercase letter")
  .regex(PASSWORD_LOWERCASE, "Password must contain at least one lowercase letter")
  .regex(PASSWORD_DIGIT, "Password must contain at least one digit")
  .regex(PASSWORD_SPECIAL, "Password must contain at least one special character");

export const RegistrationInputSchema = z.object({
  dateOfBirth: z.iso.date().optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX)),
  name: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(NAME_MIN, "Name must be at least 2 characters long")
        .max(NAME_MAX, "Name must be at most 50 characters long")
        .regex(NAME_ALLOWED, "Name may contain only letters, spaces, apostrophes and hyphens")
        .regex(NAME_HAS_LETTER, "Name must contain at least one letter"),
    ),
  nickname: NicknameSchema.optional(),
  password: PasswordSchema,
});

export const RoleSchema = z.enum(["user", "super_admin"]);

export type Role = z.infer<typeof RoleSchema>;

export const AUTH_ERROR_CODES = {
  emailNotVerified: "email_not_verified",
} as const;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const NicknameAvailabilityQuerySchema = z.object({
  nickname: NicknameSchema,
});

export type NicknameAvailabilityQuery = z.infer<typeof NicknameAvailabilityQuerySchema>;

export const NicknameAvailabilityViewSchema = z.object({
  available: z.boolean(),
});

export type NicknameAvailabilityView = z.infer<typeof NicknameAvailabilityViewSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  password: PasswordSchema,
  token: z.string().min(1),
});

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const UserViewSchema = z.object({
  createdAt: z.string(),
  dateOfBirth: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  role: RoleSchema,
});

export type UserView = z.infer<typeof UserViewSchema>;

export const AuthResultViewSchema = z.object({
  accessToken: z.string(),
  user: UserViewSchema,
});

export type AuthResultView = z.infer<typeof AuthResultViewSchema>;

export const RegistrationResultViewSchema = z.object({
  cooldownSeconds: z.number().optional(),
  email: z.string(),
  status: z.literal("verification_sent"),
});

export type RegistrationResultView = z.infer<typeof RegistrationResultViewSchema>;

export const ResendVerificationResultViewSchema = z.object({
  cooldownSeconds: z.number().optional(),
  status: z.literal("verification_sent"),
});

export type ResendVerificationResultView = z.infer<typeof ResendVerificationResultViewSchema>;

export const ForgotPasswordResultViewSchema = z.object({
  cooldownSeconds: z.number().optional(),
  status: z.literal("reset_email_sent"),
});

export type ForgotPasswordResultView = z.infer<typeof ForgotPasswordResultViewSchema>;

export const ResetPasswordResultViewSchema = z.object({
  status: z.literal("password_reset"),
});

export type ResetPasswordResultView = z.infer<typeof ResetPasswordResultViewSchema>;

export const LogoutResultViewSchema = z.object({
  status: z.literal("logged_out"),
});

export type LogoutResultView = z.infer<typeof LogoutResultViewSchema>;
