import { ApiError } from "@/lib/http-client";

const AUTH_ERROR_KEY_LIST = [
  "errors.ageTooYoung",
  "errors.emailInvalid",
  "errors.emailNotVerified",
  "errors.emailRequired",
  "errors.emailTaken",
  "errors.invalidCredentials",
  "errors.invalidToken",
  "errors.nameInvalid",
  "errors.nameRequired",
  "errors.nameTooLong",
  "errors.nameTooShort",
  "errors.nicknameInvalid",
  "errors.nicknameTaken",
  "errors.nicknameTooLong",
  "errors.nicknameTooShort",
  "errors.passwordMismatch",
  "errors.passwordRequired",
  "errors.passwordTooLong",
  "errors.required",
  "errors.serviceUnavailable",
  "errors.termsRequired",
  "errors.tooManyAttempts",
  "errors.unknown",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEY_LIST)[number];

const MESSAGE_KEY_BY_TEXT = {
  "Name may contain only letters, spaces, apostrophes and hyphens": "errors.nameInvalid",
  "Name must be at least 2 characters long": "errors.nameTooShort",
  "Name must be at most 50 characters long": "errors.nameTooLong",
  "Name must contain at least one letter": "errors.nameInvalid",
  "Nickname may contain only Latin letters, digits, underscore and dot": "errors.nicknameInvalid",
  "Nickname must be at least 3 characters long": "errors.nicknameTooShort",
  "Nickname must be at most 20 characters long": "errors.nicknameTooLong",
  "Nickname must not contain consecutive dots or underscores": "errors.nicknameInvalid",
  "Nickname must start and end with a letter or digit": "errors.nicknameInvalid",
  "Password must be at least 8 characters long": "errors.passwordRequired",
  "Password must be at most 128 characters long": "errors.passwordTooLong",
  "Password must contain at least one digit": "errors.passwordRequired",
  "Password must contain at least one lowercase letter": "errors.passwordRequired",
  "Password must contain at least one special character": "errors.passwordRequired",
  "Password must contain at least one uppercase letter": "errors.passwordRequired",
} as const satisfies Record<string, AuthErrorKey>;

const FALLBACK_KEY_BY_FIELD = {
  email: "errors.emailInvalid",
  name: "errors.nameRequired",
  nickname: "errors.nicknameInvalid",
  password: "errors.passwordRequired",
} as const satisfies Record<string, AuthErrorKey>;

const AUTH_ERROR_KEYS = new Set<string>(AUTH_ERROR_KEY_LIST);

export type ResolvedMessage = { key: AuthErrorKey; kind: "key" } | { kind: "raw"; text: string };

type ServerFieldError = {
  field: "email" | "nickname";
  key: AuthErrorKey;
};

type ServerFormError = {
  fieldErrors: ServerFieldError[];
  formMessageKey: AuthErrorKey | null;
};

export function isEmailNotVerified(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === "email_not_verified";
}

export function isInvalidToken(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && error.fieldErrors === undefined;
}

export function resolveFieldMessage(field: string, message: string | undefined): ResolvedMessage {
  if (message === undefined || message === "") return { kind: "raw", text: "" };

  const direct = asAuthErrorKey(message);
  if (direct !== null) return { key: direct, kind: "key" };

  const byText = MESSAGE_KEY_BY_TEXT[message as keyof typeof MESSAGE_KEY_BY_TEXT];
  if (byText !== undefined) return { key: byText, kind: "key" };

  const byField = FALLBACK_KEY_BY_FIELD[field as keyof typeof FALLBACK_KEY_BY_FIELD];
  if (byField !== undefined) return { key: byField, kind: "key" };

  return { kind: "raw", text: message };
}

export function resolveServerError(error: unknown): ServerFormError {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: [], formMessageKey: "errors.serviceUnavailable" };
  }

  const fieldErrors = mapFieldErrors(error);
  if (fieldErrors.length > 0) {
    return { fieldErrors, formMessageKey: null };
  }

  return { fieldErrors: [], formMessageKey: mapFormMessageKey(error) };
}

function asAuthErrorKey(value: string): AuthErrorKey | null {
  return AUTH_ERROR_KEYS.has(value) ? (value as AuthErrorKey) : null;
}

function mapFieldErrors(error: ApiError): ServerFieldError[] {
  if (error.fieldErrors === undefined) return [];

  const mapped: ServerFieldError[] = [];
  for (const item of error.fieldErrors) {
    if (item.field === "email") mapped.push({ field: "email", key: "errors.emailTaken" });
    if (item.field === "nickname") mapped.push({ field: "nickname", key: "errors.nicknameTaken" });
  }
  return mapped;
}

function mapFormMessageKey(error: ApiError): AuthErrorKey {
  if (error.status === 401) return "errors.invalidCredentials";
  if (error.status === 403 && error.code === "email_not_verified") {
    return "errors.emailNotVerified";
  }
  if (error.status === 429) return "errors.tooManyAttempts";
  if (error.status === 400) return "errors.invalidToken";
  return "errors.serviceUnavailable";
}
