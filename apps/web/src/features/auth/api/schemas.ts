import type {
  AuthResultView,
  ForgotPasswordResultView,
  LogoutResultView,
  NicknameAvailabilityView,
  RegistrationResultView,
  ResetPasswordResultView,
  UserView,
} from "@app/shared";

import { z } from "zod";

export const UserViewSchema = z.object({
  createdAt: z.string(),
  dateOfBirth: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  role: z.enum(["super_admin", "user"]),
});

export const AuthResultSchema = z.object({
  accessToken: z.string(),
  user: UserViewSchema,
});

export const RegistrationResultSchema = z.object({
  cooldownSeconds: z.number().optional(),
  email: z.string(),
  status: z.literal("verification_sent"),
});

export const ResendVerificationResultSchema = z.object({
  cooldownSeconds: z.number().optional(),
  status: z.literal("verification_sent"),
});

export const ForgotPasswordResultSchema = z.object({
  cooldownSeconds: z.number().optional(),
  status: z.literal("reset_email_sent"),
});

export const ResetPasswordResultSchema = z.object({
  status: z.literal("password_reset"),
});

export const LogoutResultSchema = z.object({
  status: z.literal("logged_out"),
});

export const NicknameAvailabilitySchema = z.object({
  available: z.boolean(),
});

type AuthResultMatches = z.infer<typeof AuthResultSchema> extends AuthResultView ? true : false;
type ForgotPasswordResultMatches =
  z.infer<typeof ForgotPasswordResultSchema> extends ForgotPasswordResultView ? true : false;
type LogoutResultMatches =
  z.infer<typeof LogoutResultSchema> extends LogoutResultView ? true : false;
type NicknameAvailabilityMatches =
  z.infer<typeof NicknameAvailabilitySchema> extends NicknameAvailabilityView ? true : false;
type RegistrationResultMatches =
  z.infer<typeof RegistrationResultSchema> extends RegistrationResultView ? true : false;
type ResetPasswordResultMatches =
  z.infer<typeof ResetPasswordResultSchema> extends ResetPasswordResultView ? true : false;
type UserViewMatches = z.infer<typeof UserViewSchema> extends UserView ? true : false;

const _userViewAligned: UserViewMatches = true;
const _authResultAligned: AuthResultMatches = true;
const _registrationResultAligned: RegistrationResultMatches = true;
const _forgotPasswordResultAligned: ForgotPasswordResultMatches = true;
const _resetPasswordResultAligned: ResetPasswordResultMatches = true;
const _logoutResultAligned: LogoutResultMatches = true;
const _nicknameAvailabilityAligned: NicknameAvailabilityMatches = true;
void _userViewAligned;
void _authResultAligned;
void _registrationResultAligned;
void _forgotPasswordResultAligned;
void _resetPasswordResultAligned;
void _logoutResultAligned;
void _nicknameAvailabilityAligned;
