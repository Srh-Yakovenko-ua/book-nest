import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ProfileController } from "./api/profile.controller.js";
import { SettingsController } from "./api/settings.controller.js";
import { SocialLinkController } from "./api/social-link.controller.js";
import { ProfileService } from "./application/profile.service.js";
import { SettingsService } from "./application/settings.service.js";
import { SocialLinkService } from "./application/social-link.service.js";
import { ProfileRepository } from "./infrastructure/profile.repository.js";
import { SettingsRepository } from "./infrastructure/settings.repository.js";
import { SocialLinkRepository } from "./infrastructure/social-link.repository.js";

@Module({
  controllers: [ProfileController, SocialLinkController, SettingsController],
  imports: [AuthModule],
  providers: [
    ProfileService,
    SocialLinkService,
    SettingsService,
    ProfileRepository,
    SocialLinkRepository,
    SettingsRepository,
  ],
})
export class ProfileModule {}
