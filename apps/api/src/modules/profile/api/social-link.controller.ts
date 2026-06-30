import type { SocialLinkView } from "@app/shared";

import { CreateSocialLinkInputSchema, UpdateSocialLinkInputSchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { SocialLinkService } from "../application/social-link.service.js";
import { CreateSocialLinkInputDto } from "./input-dto/create-social-link.input-dto.js";
import { UpdateSocialLinkInputDto } from "./input-dto/update-social-link.input-dto.js";

@ApiTags("profile")
@Controller("api/profile/social-links")
export class SocialLinkController {
  constructor(private readonly socialLinkService: SocialLinkService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateSocialLinkInputDto })
  @ApiConflictResponse({ description: "Platform or link already added" })
  @ApiCreatedResponse({ description: "The created social link" })
  @ApiOperation({ summary: "Add a social link to the current user profile" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Post()
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: UserModel,
    @Body(new ZodBodyPipe(CreateSocialLinkInputSchema)) body: CreateSocialLinkInputDto,
  ): Promise<SocialLinkView> {
    return this.socialLinkService.create(user.id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateSocialLinkInputDto })
  @ApiConflictResponse({ description: "Platform or link already added" })
  @ApiNotFoundResponse({ description: "Social link not found" })
  @ApiOkResponse({ description: "The updated social link" })
  @ApiOperation({ summary: "Update a social link of the current user profile" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.OK)
  @Patch(":id")
  @UseGuards(JwtAccessGuard)
  update(
    @CurrentUser() user: UserModel,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateSocialLinkInputSchema)) body: UpdateSocialLinkInputDto,
  ): Promise<SocialLinkView> {
    return this.socialLinkService.update(user.id, id, body);
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The social link was deleted" })
  @ApiNotFoundResponse({ description: "Social link not found" })
  @ApiOperation({ summary: "Delete a social link of the current user profile" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  delete(@CurrentUser() user: UserModel, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.socialLinkService.delete(user.id, id);
  }
}
