import type {
  AuthResultView,
  ForgotPasswordResultView,
  LogoutResultView,
  NicknameAvailabilityQuery,
  NicknameAvailabilityView,
  RegistrationResultView,
  ResetPasswordResultView,
  UserView,
} from "@app/shared";
import type { Request, Response } from "express";

import {
  ForgotPasswordInputSchema,
  LoginInputSchema,
  NicknameAvailabilityQuerySchema,
  RegistrationInputSchema,
  ResendVerificationSchema,
  ResetPasswordInputSchema,
  VerifyEmailSchema,
} from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { UserModel } from "../../../generated/prisma/models.js";

import { env } from "../../../config/env.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";
import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { AuthService } from "../application/auth.service.js";
import { EmailVerificationService } from "../application/email-verification.service.js";
import { PasswordResetService } from "../application/password-reset.service.js";
import { SessionService } from "../application/session.service.js";
import { toUserView } from "../domain/user.mapper.js";
import { CurrentUser } from "./guards/current-user.decorator.js";
import { JwtAccessGuard } from "./guards/jwt-access.guard.js";
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
const NICKNAME_AVAILABILITY_TTL_SECONDS = 60;
const NICKNAME_AVAILABILITY_LIMIT = 20;
const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 20;

const VERIFICATION_SENT: RegistrationResultView["status"] = "verification_sent";
const RESET_EMAIL_SENT: ForgotPasswordResultView["status"] = "reset_email_sent";
const LOGGED_OUT: LogoutResultView["status"] = "logged_out";

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly sessionService: SessionService,
  ) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "The currently authenticated user" })
  @ApiOperation({ summary: "Return the currently authenticated user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("me")
  @UseGuards(JwtAccessGuard)
  me(@CurrentUser() user: UserModel): UserView {
    return toUserView(user);
  }

  @ApiBadRequestResponse({ description: "Malformed nickname" })
  @ApiOkResponse({ description: "Whether the nickname is free to claim" })
  @ApiOperation({ summary: "Check whether a nickname is available" })
  @ApiQuery({
    name: "nickname",
    required: true,
    schema: { maxLength: NICKNAME_MAX_LENGTH, minLength: NICKNAME_MIN_LENGTH, type: "string" },
  })
  @Get("nickname-available")
  @Throttle({
    default: {
      limit: NICKNAME_AVAILABILITY_LIMIT,
      ttl: seconds(NICKNAME_AVAILABILITY_TTL_SECONDS),
    },
  })
  checkNicknameAvailability(
    @Query(new ZodQueryPipe(NicknameAvailabilityQuerySchema)) query: NicknameAvailabilityQuery,
  ): Promise<NicknameAvailabilityView> {
    return this.authService.isNicknameAvailable(query.nickname);
  }

  @ApiBadRequestResponse({ description: "Validation failed or email/nickname already taken" })
  @ApiBody({ type: RegistrationInputDto })
  @ApiCreatedResponse({ description: "Verification email sent; no session opened" })
  @ApiOperation({ summary: "Register a new user and send an email verification link" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post("registration")
  @Throttle({ default: { limit: REGISTRATION_LIMIT, ttl: seconds(REGISTRATION_TTL_SECONDS) } })
  async register(
    @Body(new ZodBodyPipe(RegistrationInputSchema)) body: RegistrationInputDto,
  ): Promise<RegistrationResultView> {
    const result = await this.authService.register(body);

    return { ...result, cooldownSeconds: env.resendCooldownSeconds };
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
    const { refreshToken, result, ttlDays } = await this.authService.login(body);

    this.setRefreshCookie(response, refreshToken, ttlDays * DAY_IN_MS);

    return result;
  }

  @ApiOkResponse({ description: "New access token issued, refresh cookie rotated" })
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  @ApiUnauthorizedResponse({
    description: "Missing, invalid, expired, or reused refresh token",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultView> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof presented !== "string" || presented.length === 0) {
      throw new UnauthorizedError("Missing refresh token");
    }

    const { expiresAt, refreshToken, result } = await this.sessionService.refresh(presented);

    const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());
    this.setRefreshCookie(response, refreshToken, remainingMs);

    return result;
  }

  @ApiOkResponse({ description: "Session revoked and refresh cookie cleared" })
  @ApiOperation({ summary: "Revoke the current session and clear the refresh cookie" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResultView> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof presented === "string" && presented.length > 0) {
      await this.sessionService.revoke(presented);
    }

    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
      sameSite: "lax",
      secure: env.cookieSecure,
    });

    return { status: LOGGED_OUT };
  }

  @ApiBody({ type: ResendVerificationInputDto })
  @ApiOkResponse({ description: "Verification email sent if the account exists and is unverified" })
  @ApiOperation({ summary: "Resend the email verification link" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("resend-verification")
  @Throttle({ default: { limit: RESEND_LIMIT, ttl: seconds(RESEND_TTL_SECONDS) } })
  async resendVerification(
    @Body(new ZodBodyPipe(ResendVerificationSchema)) body: ResendVerificationInputDto,
  ): Promise<{ cooldownSeconds: number; status: RegistrationResultView["status"] }> {
    await this.emailVerificationService.resend(body.email);

    return { cooldownSeconds: env.resendCooldownSeconds, status: VERIFICATION_SENT };
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

    return { cooldownSeconds: env.resendCooldownSeconds, status: RESET_EMAIL_SENT };
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

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    maxAgeMs: number = env.refreshTokenTtlDays * DAY_IN_MS,
  ): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      maxAge: maxAgeMs,
      path: REFRESH_COOKIE_PATH,
      sameSite: "lax",
      secure: env.cookieSecure,
    });
  }
}
