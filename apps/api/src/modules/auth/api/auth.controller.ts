import type {
  AuthResultView,
  ForgotPasswordResultView,
  RegistrationResultView,
  ResetPasswordResultView,
} from "@app/shared";
import type { Response } from "express";

import {
  ForgotPasswordInputSchema,
  LoginInputSchema,
  RegistrationInputSchema,
  ResendVerificationSchema,
  ResetPasswordInputSchema,
  VerifyEmailSchema,
} from "@app/shared";
import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import { env } from "../../../config/env.js";
import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { AuthService } from "../application/auth.service.js";
import { EmailVerificationService } from "../application/email-verification.service.js";
import { PasswordResetService } from "../application/password-reset.service.js";
import { ForgotPasswordInputDto } from "./input-dto/forgot-password.input-dto.js";
import { LoginInputDto } from "./input-dto/login.input-dto.js";
import { RegistrationInputDto } from "./input-dto/registration.input-dto.js";
import { ResendVerificationInputDto } from "./input-dto/resend-verification.input-dto.js";
import { ResetPasswordInputDto } from "./input-dto/reset-password.input-dto.js";
import { VerifyEmailInputDto } from "./input-dto/verify-email.input-dto.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_TTL_SECONDS = 60;
const REGISTRATION_LIMIT = 5;
const RESEND_TTL_SECONDS = 60;
const RESEND_LIMIT = 3;
const LOGIN_TTL_SECONDS = 60;
const LOGIN_LIMIT = 10;
const FORGOT_PASSWORD_TTL_SECONDS = 60;
const FORGOT_PASSWORD_LIMIT = 3;
const RESET_PASSWORD_TTL_SECONDS = 60;
const RESET_PASSWORD_LIMIT = 5;

const VERIFICATION_SENT: RegistrationResultView["status"] = "verification_sent";
const RESET_EMAIL_SENT: ForgotPasswordResultView["status"] = "reset_email_sent";

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @ApiBadRequestResponse({ description: "Validation failed or email/nickname already taken" })
  @ApiBody({ type: RegistrationInputDto })
  @ApiCreatedResponse({ description: "Verification email sent; no session opened" })
  @ApiOperation({ summary: "Register a new user and send an email verification link" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post("registration")
  @Throttle({ default: { limit: REGISTRATION_LIMIT, ttl: seconds(REGISTRATION_TTL_SECONDS) } })
  register(
    @Body(new ZodBodyPipe(RegistrationInputSchema)) body: RegistrationInputDto,
  ): Promise<RegistrationResultView> {
    return this.authService.register(body);
  }

  @ApiBadRequestResponse({ description: "Invalid or expired verification link" })
  @ApiBody({ type: VerifyEmailInputDto })
  @ApiOkResponse({ description: "Email verified; access token returned, refresh cookie set" })
  @ApiOperation({ summary: "Verify an email and open a session" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("verify-email")
  async verifyEmail(
    @Body(new ZodBodyPipe(VerifyEmailSchema)) body: VerifyEmailInputDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultView> {
    const { refreshToken, result } = await this.emailVerificationService.verify(body.token);

    this.setRefreshCookie(response, refreshToken);

    return result;
  }

  @ApiBody({ type: LoginInputDto })
  @ApiForbiddenResponse({ description: "Email not verified" })
  @ApiOkResponse({ description: "Logged in; access token returned, refresh cookie set" })
  @ApiOperation({ summary: "Authenticate with email and password and open a session" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("login")
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: seconds(LOGIN_TTL_SECONDS) } })
  async login(
    @Body(new ZodBodyPipe(LoginInputSchema)) body: LoginInputDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultView> {
    const { refreshToken, result } = await this.authService.login(body);

    this.setRefreshCookie(response, refreshToken);

    return result;
  }

  @ApiBody({ type: ResendVerificationInputDto })
  @ApiOkResponse({ description: "Verification email sent if the account exists and is unverified" })
  @ApiOperation({ summary: "Resend the email verification link" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("resend-verification")
  @Throttle({ default: { limit: RESEND_LIMIT, ttl: seconds(RESEND_TTL_SECONDS) } })
  async resendVerification(
    @Body(new ZodBodyPipe(ResendVerificationSchema)) body: ResendVerificationInputDto,
  ): Promise<{ status: RegistrationResultView["status"] }> {
    await this.emailVerificationService.resend(body.email);

    return { status: VERIFICATION_SENT };
  }

  @ApiBody({ type: ForgotPasswordInputDto })
  @ApiOkResponse({ description: "If the account exists, a reset email was sent" })
  @ApiOperation({ summary: "Send a password reset link if the account exists and is verified" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("forgot-password")
  @Throttle({
    default: { limit: FORGOT_PASSWORD_LIMIT, ttl: seconds(FORGOT_PASSWORD_TTL_SECONDS) },
  })
  async forgotPassword(
    @Body(new ZodBodyPipe(ForgotPasswordInputSchema)) body: ForgotPasswordInputDto,
  ): Promise<ForgotPasswordResultView> {
    await this.passwordResetService.requestReset(body.email);

    return { status: RESET_EMAIL_SENT };
  }

  @ApiBadRequestResponse({ description: "Invalid or expired reset link" })
  @ApiBody({ type: ResetPasswordInputDto })
  @ApiOkResponse({ description: "Password reset; all sessions invalidated" })
  @ApiOperation({ summary: "Set a new password using a reset token and invalidate all sessions" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("reset-password")
  @Throttle({ default: { limit: RESET_PASSWORD_LIMIT, ttl: seconds(RESET_PASSWORD_TTL_SECONDS) } })
  resetPassword(
    @Body(new ZodBodyPipe(ResetPasswordInputSchema)) body: ResetPasswordInputDto,
  ): Promise<ResetPasswordResultView> {
    return this.passwordResetService.reset(body.token, body.password);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      maxAge: env.refreshTokenTtlDays * DAY_IN_MS,
      path: REFRESH_COOKIE_PATH,
      sameSite: "lax",
      secure: env.cookieSecure,
    });
  }
}
