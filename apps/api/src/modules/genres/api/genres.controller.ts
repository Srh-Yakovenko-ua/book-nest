import type { GenreView } from "@app/shared";

import { CreateGenreSchema, RecentGenresQuerySchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { UserModel } from "../../../generated/prisma/models.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser } from "../../auth/api/guards/current-user.decorator.js";
import { JwtAccessGuard } from "../../auth/api/guards/jwt-access.guard.js";
import { GenresService } from "../application/genres.service.js";
import { CreateGenreDto } from "./input-dto/create-genre.input-dto.js";
import { RecentGenresQueryDto } from "./input-dto/recent-genres-query.input-dto.js";

@ApiTags("genres")
@Controller("api/genres")
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ description: "The genres available to the current user" })
  @ApiOperation({ summary: "List the global default genres and the current user custom genres" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get()
  @UseGuards(JwtAccessGuard)
  list(@CurrentUser() user: UserModel): Promise<GenreView[]> {
    return this.genresService.list(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBearerAuth()
  @ApiBody({ type: CreateGenreDto })
  @ApiConflictResponse({ description: "A genre with this name already exists" })
  @ApiCreatedResponse({ description: "The created custom genre" })
  @ApiOperation({ summary: "Create a custom genre for the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post()
  @UseGuards(JwtAccessGuard)
  create(
    @CurrentUser() user: UserModel,
    @Body(new ZodBodyPipe(CreateGenreSchema)) body: CreateGenreDto,
  ): Promise<GenreView> {
    return this.genresService.create(user.id, body);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: "Genres the current user recently used in their own books" })
  @ApiOperation({ summary: "List recently used genres for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Get("recent")
  @UseGuards(JwtAccessGuard)
  recent(
    @CurrentUser() user: UserModel,
    @Query(new ZodQueryPipe(RecentGenresQuerySchema)) query: RecentGenresQueryDto,
  ): Promise<GenreView[]> {
    return this.genresService.recent({ limit: query.limit, userId: user.id });
  }

  @ApiBearerAuth()
  @ApiNoContentResponse({ description: "The genre was deleted" })
  @ApiNotFoundResponse({ description: "Genre not found" })
  @ApiOperation({ summary: "Delete a custom genre of the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  delete(@CurrentUser() user: UserModel, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.genresService.delete(user.id, id);
  }
}
