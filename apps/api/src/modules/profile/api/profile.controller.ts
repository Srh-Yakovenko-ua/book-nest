import type { ProfileView } from "@app/shared";

import { UpdateProfileInputSchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Patch } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { ProfileService } from "../application/profile.service.js";
import { UpdateProfileInputDto } from "./input-dto/update-profile.input-dto.js";

@ApiTags("profile")
@Controller("api/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}
  @ApiNotFoundResponse({ description: "Profile not found" })
  @ApiOkResponse({ description: "The current user profile" })
  @ApiOperation({ summary: "Return the current user profile" })
  @Get()
  @JwtProtected()
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileView> {
    return this.profileService.getProfile(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateProfileInputDto })
  @ApiConflictResponse({ description: "Nickname already taken" })
  @ApiOkResponse({ description: "The updated user profile" })
  @ApiOperation({ summary: "Update the current user profile" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(UpdateProfileInputSchema)) body: UpdateProfileInputDto,
  ): Promise<ProfileView> {
    return this.profileService.updateProfile(user.id, body);
  }
}
