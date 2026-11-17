import type {
  AuthResultView,
  ForgotPasswordResultView,
  LogoutResultView,
  NicknameAvailabilityQuery,
  NicknameAvailabilityView,
  RegistrationResultView,
  ResendVerificationResultView,
  ResetPasswordResultView,
  UserView,
} from "@app/shared";
import type { Request, Response } from "express";

import {
  ForgotPasswordInputSchema,
  ForgotPasswordResultViewSchema,
  LoginInputSchema,
  LogoutResultViewSchema,
  NicknameAvailabilityQuerySchema,
  NicknameSchema,
  RegistrationInputSchema,
  ResendVerificationResultViewSchema,
  ResendVerificationSchema,
  ResetPasswordInputSchema,
  VerifyEmailSchema,
} from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
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
import { differenceInMilliseconds, milliseconds } from "date-fns";

import type { AuthenticatedUser } from "../domain/authenticated-user.js";

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
import { JwtProtected } from "./guards/jwt-protected.decorator.js";
import { ForgotPasswordInputDto } from "./input-dto/forgot-password.input-dto.js";
import { LoginInputDto } from "./input-dto/login.input-dto.js";
import { RegistrationInputDto } from "./input-dto/registration.input-dto.js";
import { ResendVerificationInputDto } from "./input-dto/resend-verification.input-dto.js";
import { ResetPasswordInputDto } from "./input-dto/reset-password.input-dto.js";
import { VerifyEmailInputDto } from "./input-dto/verify-email.input-dto.js";
import { AuthResultViewDto } from "./view-dto/auth-result.view-dto.js";
import { ForgotPasswordResultViewDto } from "./view-dto/forgot-password-result.view-dto.js";
import { LogoutResultViewDto } from "./view-dto/logout-result.view-dto.js";
import { NicknameAvailabilityViewDto } from "./view-dto/nickname-availability.view-dto.js";
import { RegistrationResultViewDto } from "./view-dto/registration-result.view-dto.js";
import { ResendVerificationResultViewDto } from "./view-dto/resend-verification-result.view-dto.js";
import { ResetPasswordResultViewDto } from "./view-dto/reset-password-result.view-dto.js";
import { UserViewDto } from "./view-dto/user.view-dto.js";

const REFRESH_COOKIE = {
  name: "refresh_token",
  options: {
    httpOnly: true,
    path: "/api/auth",
    sameSite: "lax",
    secure: env.cookieSecure,
  },
} as const;

const AUTH_THROTTLE = {
  forgotPassword: { default: { limit: 3, ttl: seconds(60) } },
  login: { default: { limit: 10, ttl: seconds(60) } },
  nicknameAvailability: { default: { limit: 20, ttl: seconds(60) } },
  registration: { default: { limit: 5, ttl: seconds(60) } },
  resendVerification: { default: { limit: 3, ttl: seconds(60) } },
  resetPassword: { default: { limit: 5, ttl: seconds(60) } },
} as const;

@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly sessionService: SessionService,
  ) {}

  @ApiOkResponse({ description: "The currently authenticated user", type: UserViewDto })
  @ApiOperation({ summary: "Return the currently authenticated user" })
  @Get("me")
  @JwtProtected()
  me(@CurrentUser() user: AuthenticatedUser): UserView {
    return toUserView(user);
  }

  @ApiBadRequestResponse({ description: "Malformed nickname" })
  @ApiOkResponse({
    description: "Whether the nickname is free to claim",
    type: NicknameAvailabilityViewDto,
  })
  @ApiOperation({ summary: "Check whether a nickname is available" })
  @ApiQuery({
    name: "nickname",
    required: true,
    schema: {
      maxLength: NicknameSchema.maxLength ?? undefined,
      minLength: NicknameSchema.minLength ?? undefined,
      type: "string",
    },
  })
  @Get("nickname-available")
  @Throttle(AUTH_THROTTLE.nicknameAvailability)
  checkNicknameAvailability(
    @Query(new ZodQueryPipe(NicknameAvailabilityQuerySchema)) query: NicknameAvailabilityQuery,
  ): Promise<NicknameAvailabilityView> {
    return this.authService.isNicknameAvailable(query.nickname);
  }

  @ApiBadRequestResponse({ description: "Validation failed or email/nickname already taken" })
  @ApiBody({ type: RegistrationInputDto })
  @ApiCreatedResponse({
    description: "Verification email sent; no session opened",
    type: RegistrationResultViewDto,
  })
  @ApiOperation({ summary: "Register a new user and send an email verification link" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post("registration")
  @Throttle(AUTH_THROTTLE.registration)
  async register(
    @Body(new ZodBodyPipe(RegistrationInputSchema)) body: RegistrationInputDto,
  ): Promise<RegistrationResultView> {
    const result = await this.authService.register(body);

    return { ...result, cooldownSeconds: env.resendCooldownSeconds };
  }

  @ApiBadRequestResponse({ description: "Invalid or expired verification link" })
  @ApiBody({ type: VerifyEmailInputDto })
  @ApiOkResponse({
    description: "Email verified; access token returned, refresh cookie set",
    type: AuthResultViewDto,
  })
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
  @ApiOkResponse({
    description: "Logged in; access token returned, refresh cookie set",
    type: AuthResultViewDto,
  })
  @ApiOperation({ summary: "Authenticate with email and password and open a session" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("login")
  @Throttle(AUTH_THROTTLE.login)
  async login(
    @Body(new ZodBodyPipe(LoginInputSchema)) body: LoginInputDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResultView> {
    const { refreshToken, result, ttlDays } = await this.authService.login(body);

    this.setRefreshCookie(response, refreshToken, milliseconds({ days: ttlDays }));

    return result;
  }

  @ApiOkResponse({
    description: "New access token issued, refresh cookie rotated",
    type: AuthResultViewDto,
  })
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
    const presented = request.cookies?.[REFRESH_COOKIE.name];
    if (typeof presented !== "string" || presented.length === 0) {
      throw new UnauthorizedError("Missing refresh token");
    }

    const { expiresAt, refreshToken, result } = await this.sessionService.refresh(presented);

    const remainingMs = Math.max(0, differenceInMilliseconds(expiresAt, new Date()));
    this.setRefreshCookie(response, refreshToken, remainingMs);

    return result;
  }

  @ApiOkResponse({
    description: "Session revoked and refresh cookie cleared",
    type: LogoutResultViewDto,
  })
  @ApiOperation({ summary: "Revoke the current session and clear the refresh cookie" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResultView> {
    const presented = request.cookies?.[REFRESH_COOKIE.name];
    if (typeof presented === "string" && presented.length > 0) {
      await this.sessionService.revoke(presented);
    }

    response.clearCookie(REFRESH_COOKIE.name, { ...REFRESH_COOKIE.options });

    return { status: LogoutResultViewSchema.shape.status.value };
  }

  @ApiBody({ type: ResendVerificationInputDto })
  @ApiOkResponse({
    description: "Verification email sent if the account exists and is unverified",
    type: ResendVerificationResultViewDto,
  })
  @ApiOperation({ summary: "Resend the email verification link" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("resend-verification")
  @Throttle(AUTH_THROTTLE.resendVerification)
  async resendVerification(
    @Body(new ZodBodyPipe(ResendVerificationSchema)) body: ResendVerificationInputDto,
  ): Promise<ResendVerificationResultView> {
    await this.emailVerificationService.resend(body.email);

    return {
      cooldownSeconds: env.resendCooldownSeconds,
      status: ResendVerificationResultViewSchema.shape.status.value,
    };
  }

  @ApiBody({ type: ForgotPasswordInputDto })
  @ApiOkResponse({
    description: "If the account exists, a reset email was sent",
    type: ForgotPasswordResultViewDto,
  })
  @ApiOperation({ summary: "Send a password reset link if the account exists and is verified" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("forgot-password")
  @Throttle(AUTH_THROTTLE.forgotPassword)
  async forgotPassword(
    @Body(new ZodBodyPipe(ForgotPasswordInputSchema)) body: ForgotPasswordInputDto,
  ): Promise<ForgotPasswordResultView> {
    await this.passwordResetService.requestReset(body.email);

    return {
      cooldownSeconds: env.resendCooldownSeconds,
      status: ForgotPasswordResultViewSchema.shape.status.value,
    };
  }

  @ApiBadRequestResponse({ description: "Invalid or expired reset link" })
  @ApiBody({ type: ResetPasswordInputDto })
  @ApiOkResponse({
    description: "Password reset; all sessions invalidated",
    type: ResetPasswordResultViewDto,
  })
  @ApiOperation({ summary: "Set a new password using a reset token and invalidate all sessions" })
  @HttpCode(HTTP_STATUS.OK)
  @Post("reset-password")
  @Throttle(AUTH_THROTTLE.resetPassword)
  resetPassword(
    @Body(new ZodBodyPipe(ResetPasswordInputSchema)) body: ResetPasswordInputDto,
  ): Promise<ResetPasswordResultView> {
    return this.passwordResetService.reset(body.token, body.password);
  }

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    maxAgeMs: number = milliseconds({ days: env.refreshTokenTtlDays }),
  ): void {
    response.cookie(REFRESH_COOKIE.name, refreshToken, {
      ...REFRESH_COOKIE.options,
      maxAge: maxAgeMs,
    });
  }
}
