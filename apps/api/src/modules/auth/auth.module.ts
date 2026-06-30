import { Module } from "@nestjs/common";

import { MailModule } from "../mail/mail.module.js";
import { AuthController } from "./api/auth.controller.js";
import { JwtAccessGuard } from "./api/guards/jwt-access.guard.js";
import { AuthService } from "./application/auth.service.js";
import { EmailVerificationService } from "./application/email-verification.service.js";
import { PasswordResetService } from "./application/password-reset.service.js";
import { PasswordService } from "./application/password.service.js";
import { SessionService } from "./application/session.service.js";
import { TokenService } from "./application/token.service.js";
import { EmailVerificationTokensRepository } from "./infrastructure/email-verification-tokens.repository.js";
import { PasswordResetTokensRepository } from "./infrastructure/password-reset-tokens.repository.js";
import { SessionsRepository } from "./infrastructure/sessions.repository.js";
import { UsersRepository } from "./infrastructure/users.repository.js";

@Module({
  controllers: [AuthController],
  exports: [JwtAccessGuard, TokenService, UsersRepository],
  imports: [MailModule],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    PasswordService,
    SessionService,
    TokenService,
    UsersRepository,
    SessionsRepository,
    EmailVerificationTokensRepository,
    PasswordResetTokensRepository,
    JwtAccessGuard,
  ],
})
export class AuthModule {}
