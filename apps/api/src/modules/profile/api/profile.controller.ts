import type { ProfileView } from "@app/shared";

import { UpdateProfileInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Patch, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { UserModel } from "../../../generated/prisma/models.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { ProfileService } from "../application/profile.service.js";
import { UpdateProfileInputDto } from "./input-dto/update-profile.input-dto.js";

@ApiTags("profile")
@Controller("api/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: "Profile not found" })
  @ApiOkResponse({ description: "The current user profile" })
  @ApiOperation({ summary: "Return the current user profile" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  getProfile(@CurrentUser() user: UserModel): Promise<ProfileView> {
    return this.profileService.getProfile(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateProfileInputDto })
  @ApiConflictResponse({ description: "Nickname already taken" })
  @ApiOkResponse({ description: "The updated user profile" })
  @ApiOperation({ summary: "Update the current user profile" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch()
  @UseGuards(JwtAccessGuard)
  updateProfile(
    @CurrentUser() user: UserModel,
    @Body(new ZodBodyPipe(UpdateProfileInputSchema)) body: UpdateProfileInputDto,
  ): Promise<ProfileView> {
    return this.profileService.updateProfile(user.id, body);
  }
}
