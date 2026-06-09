import { z } from "zod";

export type ApiError = {
  code?: string;
  message: string;
  requestId?: string;
};

export type ApiErrorResult = {
  errorsMessages: FieldError[];
};

export type ApiHealth = {
  postgres: "down" | "ok";
  status: "degraded" | "down" | "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type FieldError = {
  field: string;
  message: string;
};

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export const LIST_PAGE_SIZE_MAX = 100;

export const PaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

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
  nickname: z
    .string()
    .trim()
    .min(NICKNAME_MIN, "Nickname must be at least 3 characters long")
    .max(NICKNAME_MAX, "Nickname must be at most 20 characters long")
    .regex(NICKNAME_PATTERN, "Nickname may contain only Latin letters, digits, underscore and dot")
    .regex(NICKNAME_EDGES, "Nickname must start and end with a letter or digit")
    .regex(NICKNAME_NO_REPEAT, "Nickname must not contain consecutive dots or underscores")
    .optional(),
  password: PasswordSchema,
});

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

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

export type AuthResultView = {
  accessToken: string;
  user: UserView;
};

export type ForgotPasswordResultView = { status: "reset_email_sent" };

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export type RegistrationResultView = {
  email: string;
  status: "verification_sent";
};

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export type ResetPasswordResultView = { status: "password_reset" };

export type UserView = {
  createdAt: string;
  dateOfBirth: null | string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  nickname: null | string;
};
