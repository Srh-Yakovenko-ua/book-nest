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
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { SocialLinkService } from "../application/social-link.service.js";
import { CreateSocialLinkInputDto } from "./input-dto/create-social-link.input-dto.js";
import { UpdateSocialLinkInputDto } from "./input-dto/update-social-link.input-dto.js";

@ApiTags("profile")
@Controller("api/profile/social-links")
export class SocialLinkController {
  constructor(private readonly socialLinkService: SocialLinkService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateSocialLinkInputDto })
  @ApiConflictResponse({ description: "Platform or link already added" })
  @ApiCreatedResponse({ description: "The created social link" })
  @ApiOperation({ summary: "Add a social link to the current user profile" })
  @JwtProtected()
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateSocialLinkInputSchema)) body: CreateSocialLinkInputDto,
  ): Promise<SocialLinkView> {
    return this.socialLinkService.create(user.id, body);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateSocialLinkInputDto })
  @ApiConflictResponse({ description: "Platform or link already added" })
  @ApiNotFoundResponse({ description: "Social link not found" })
  @ApiOkResponse({ description: "The updated social link" })
  @ApiOperation({ summary: "Update a social link of the current user profile" })
  @HttpCode(HTTP_STATUS.OK)
  @JwtProtected()
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodBodyPipe(UpdateSocialLinkInputSchema)) body: UpdateSocialLinkInputDto,
  ): Promise<SocialLinkView> {
    return this.socialLinkService.update(user.id, id, body);
  }
  @ApiNoContentResponse({ description: "The social link was deleted" })
  @ApiNotFoundResponse({ description: "Social link not found" })
  @ApiOperation({ summary: "Delete a social link of the current user profile" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.socialLinkService.delete(user.id, id);
  }
}
