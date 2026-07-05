import type { SettingsView } from "@app/shared";

import { UpdateSettingsInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { SettingsService } from "../application/settings.service.js";
import { UpdateSettingsInputDto } from "./input-dto/update-settings.input-dto.js";

@ApiTags("profile")
@Controller("api/profile/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "The current user settings" })
  @ApiOperation({ summary: "Return the current user settings" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  getSettings(@CurrentUser() user: AuthenticatedUser): Promise<SettingsView> {
    return this.settingsService.getSettings(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateSettingsInputDto })
  @ApiOkResponse({ description: "The updated user settings" })
  @ApiOperation({ summary: "Update the current user settings" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch()
  @UseGuards(JwtAccessGuard)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(UpdateSettingsInputSchema)) body: UpdateSettingsInputDto,
  ): Promise<SettingsView> {
    return this.settingsService.updateSettings(user.id, body);
  }
}
