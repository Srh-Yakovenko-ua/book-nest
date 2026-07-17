import type { CharacterDetailsView } from "@app/shared";

import { CreateCharacterSchema } from "@app/shared";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharactersService } from "../application/characters.service.js";
import { CreateCharacterInputDto } from "./input-dto/create-character.input-dto.js";
import { CharacterDetailsViewDto } from "./view-dto/character-details.view-dto.js";

const CHARACTER_ACTION_TTL_SECONDS = 60;
const CHARACTER_ACTION_LIMIT = 60;

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/characters")
@UseGuards(JwtAccessGuard)
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateCharacterInputDto })
  @ApiCreatedResponse({ description: "The created character", type: CharacterDetailsViewDto })
  @ApiNotFoundResponse({ description: "Book or media not found" })
  @ApiOperation({ summary: "Create a global character, optionally with a first book appearance" })
  @Post()
  @Throttle({
    default: { limit: CHARACTER_ACTION_LIMIT, ttl: seconds(CHARACTER_ACTION_TTL_SECONDS) },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateCharacterSchema)) body: CreateCharacterInputDto,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.createGlobalCharacter(user.id, body);
  }

  @ApiNotFoundResponse({ description: "Character not found" })
  @ApiOkResponse({
    description: "The character with its appearances",
    type: CharacterDetailsViewDto,
  })
  @ApiOperation({ summary: "Get a global character with its book appearances" })
  @ApiParam({ description: "Character id", name: "characterId" })
  @Get(":characterId")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("characterId", ParseUUIDPipe) characterId: string,
  ): Promise<CharacterDetailsView> {
    return this.charactersService.getCharacterDetails(user.id, characterId);
  }
}
