import type { CharacterBundle, CharacterImportResultView } from "@app/shared";

import { CharacterExportQuerySchema } from "@app/shared";
import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtAccessGuard } from "../../auth/index.js";
import { CharacterPortabilityService } from "../application/character-portability.service.js";
import { CharacterExportQueryDto } from "./input-dto/character-export-query.input-dto.js";
import { CharacterImportBundleDto } from "./input-dto/character-import.input-dto.js";
import { CharacterBundleDto } from "./view-dto/character-bundle.view-dto.js";
import { CharacterImportResultDto } from "./view-dto/character-import-result.view-dto.js";

const PORTABILITY_TTL_SECONDS = 60;
const CHARACTER_EXPORT_LIMIT = 20;
const CHARACTER_IMPORT_LIMIT = 10;

@ApiBearerAuth()
@ApiTags("characters")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("api/characters")
@UseGuards(JwtAccessGuard)
export class CharacterPortabilityController {
  constructor(private readonly portabilityService: CharacterPortabilityService) {}

  @ApiOkResponse({
    description: "A portable, versioned bundle of the caller's entire character graph",
    type: CharacterBundleDto,
  })
  @ApiOperation({ summary: "Export the caller's character graph as a portable JSON bundle" })
  @ApiQuery({
    description: "Whether to include archived characters (defaults to true)",
    name: "includeArchived",
    required: false,
  })
  @Get("export")
  @Throttle({ default: { limit: CHARACTER_EXPORT_LIMIT, ttl: seconds(PORTABILITY_TTL_SECONDS) } })
  exportBundle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(CharacterExportQuerySchema)) query: CharacterExportQueryDto,
  ): Promise<CharacterBundle> {
    return this.portabilityService.export({ query, userId: user.id });
  }

  @ApiBody({ type: CharacterImportBundleDto })
  @ApiOkResponse({
    description: "A summary of what the import created and what it skipped",
    type: CharacterImportResultDto,
  })
  @ApiOperation({ summary: "Import a character bundle into the caller's library" })
  @ApiUnprocessableEntityResponse({
    description: "The bundle is invalid or exceeds the size limit",
  })
  @HttpCode(HTTP_STATUS.OK)
  @Post("import")
  @Throttle({ default: { limit: CHARACTER_IMPORT_LIMIT, ttl: seconds(PORTABILITY_TTL_SECONDS) } })
  importBundle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<CharacterImportResultView> {
    return this.portabilityService.import({ payload: body, userId: user.id });
  }
}
