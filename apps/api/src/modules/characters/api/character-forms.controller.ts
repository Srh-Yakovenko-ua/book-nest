import type { CharacterFormListView, CharacterFormView } from "@app/shared";

import { CreateCharacterFormSchema, UpdateCharacterFormSchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterFormsService } from "../application/character-forms.service.js";
import { CreateCharacterFormInputDto } from "./input-dto/create-character-form.input-dto.js";
import { UpdateCharacterFormInputDto } from "./input-dto/update-character-form.input-dto.js";
import { CharacterFormListViewDto } from "./view-dto/character-form-list.view-dto.js";
import { CharacterFormViewDto } from "./view-dto/character-form.view-dto.js";

const CHARACTER_FORM_ACTION_TTL_SECONDS = 60;
const CHARACTER_FORM_ACTION_LIMIT = 60;
@ApiTags("character-forms")
@Controller("api/characters/:characterId/forms")
@JwtProtected()
export class CharacterFormsController {
  constructor(private readonly characterFormsService: CharacterFormsService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterFormInputDto })
  @ApiConflictResponse({ description: "A form with this name already exists for the character" })
  @ApiCreatedResponse({ description: "The created form", type: CharacterFormViewDto })
  @ApiNotFoundResponse({ description: "Character or media not found" })
  @ApiOperation({ summary: "Create an in-world form for a character" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Post()
  @Throttle({
    default: {
      limit: CHARACTER_FORM_ACTION_LIMIT,
      ttl: seconds(CHARACTER_FORM_ACTION_TTL_SECONDS),
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Body(new ZodBodyPipe(CreateCharacterFormSchema)) body: CreateCharacterFormInputDto,
  ): Promise<CharacterFormView> {
    return this.characterFormsService.create({ characterId, input: body, userId: user.id });
  }

  @ApiNotFoundResponse({ description: "Character not found" })
  @ApiOkResponse({ description: "The character's forms", type: CharacterFormListViewDto })
  @ApiOperation({ summary: "List a character's in-world forms" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<CharacterFormListView> {
    return this.characterFormsService.list({ characterId, userId: user.id });
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: UpdateCharacterFormInputDto })
  @ApiConflictResponse({ description: "A form with this name already exists for the character" })
  @ApiNotFoundResponse({ description: "Character, form or media not found" })
  @ApiOkResponse({ description: "The updated form", type: CharacterFormViewDto })
  @ApiOperation({ summary: "Update a character's in-world form" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiParam({ description: "Form id", name: "formId" })
  @Patch(":formId")
  @Throttle({
    default: {
      limit: CHARACTER_FORM_ACTION_LIMIT,
      ttl: seconds(CHARACTER_FORM_ACTION_TTL_SECONDS),
    },
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Param("formId", ParseUUIDPipe) formId: string,
    @Body(new ZodBodyPipe(UpdateCharacterFormSchema)) body: UpdateCharacterFormInputDto,
  ): Promise<CharacterFormView> {
    return this.characterFormsService.update({ characterId, formId, input: body, userId: user.id });
  }

  @ApiNoContentResponse({ description: "The form was deleted" })
  @ApiNotFoundResponse({ description: "Character or form not found" })
  @ApiOperation({ summary: "Delete a character's in-world form" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @ApiParam({ description: "Form id", name: "formId" })
  @Delete(":formId")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @Throttle({
    default: {
      limit: CHARACTER_FORM_ACTION_LIMIT,
      ttl: seconds(CHARACTER_FORM_ACTION_TTL_SECONDS),
    },
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
    @Param("formId", ParseUUIDPipe) formId: string,
  ): Promise<void> {
    return this.characterFormsService.remove({ characterId, formId, userId: user.id });
  }
}
