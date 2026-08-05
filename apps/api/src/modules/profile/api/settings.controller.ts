import type { SettingsView } from "@app/shared";

import { UpdateSettingsInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Patch } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { SettingsService } from "../application/settings.service.js";
import { UpdateSettingsInputDto } from "./input-dto/update-settings.input-dto.js";
import { SettingsViewDto } from "./view-dto/settings.view-dto.js";

@ApiTags("profile")
@Controller("api/profile/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}
  @ApiOkResponse({ description: "The current user settings", type: SettingsViewDto })
  @ApiOperation({ summary: "Return the current user settings" })
  @Get()
  @JwtProtected()
  getSettings(@CurrentUser() user: AuthenticatedUser): Promise<SettingsView> {
    return this.settingsService.getSettings(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateSettingsInputDto })
  @ApiOkResponse({ description: "The updated user settings", type: SettingsViewDto })
  @ApiOperation({ summary: "Update the current user settings" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(UpdateSettingsInputSchema)) body: UpdateSettingsInputDto,
  ): Promise<SettingsView> {
    return this.settingsService.updateSettings(user.id, body);
  }
}
