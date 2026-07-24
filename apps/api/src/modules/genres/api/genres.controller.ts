import type { GenreStatsView, GenreView } from "@app/shared";

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
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { ZodQueryPipe } from "../../../core/pipes/zod-query.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { GenresService } from "../application/genres.service.js";
import { CreateGenreDto } from "./input-dto/create-genre.input-dto.js";
import { RecentGenresQueryDto } from "./input-dto/recent-genres-query.input-dto.js";
import { GenreStatsViewDto } from "./view-dto/genre-stats.view-dto.js";

@ApiTags("genres")
@Controller("api/genres")
export class GenresController {
  constructor(private readonly genresService: GenresService) {}
  @ApiOkResponse({ description: "The genres available to the current user" })
  @ApiOperation({ summary: "List the global default genres and the current user custom genres" })
  @Get()
  @JwtProtected()
  list(@CurrentUser() user: AuthenticatedUser): Promise<GenreView[]> {
    return this.genresService.list(user.id);
  }

  @ApiBadRequestResponse({ description: "Validation failed" })
  @ApiBody({ type: CreateGenreDto })
  @ApiConflictResponse({ description: "A genre with this name already exists" })
  @ApiCreatedResponse({ description: "The created custom genre" })
  @ApiOperation({ summary: "Create a custom genre for the current user" })
  @HttpCode(HTTP_STATUS.CREATED)
  @JwtProtected()
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateGenreSchema)) body: CreateGenreDto,
  ): Promise<GenreView> {
    return this.genresService.create(user.id, body);
  }
  @ApiOkResponse({ description: "Genres the current user recently used in their own books" })
  @ApiOperation({ summary: "List recently used genres for the current user" })
  @ApiQuery({ name: "limit", required: false })
  @Get("recent")
  @JwtProtected()
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodQueryPipe(RecentGenresQuerySchema)) query: RecentGenresQueryDto,
  ): Promise<GenreView[]> {
    return this.genresService.recent({ limit: query.limit, userId: user.id });
  }
  @ApiOkResponse({
    description: "Per-genre statistics over the current user library",
    type: [GenreStatsViewDto],
  })
  @ApiOperation({ summary: "Get per-genre statistics for the current user library" })
  @Get("stats")
  @JwtProtected()
  stats(@CurrentUser() user: AuthenticatedUser): Promise<GenreStatsView[]> {
    return this.genresService.stats(user.id);
  }
  @ApiNoContentResponse({ description: "The genre was deleted" })
  @ApiNotFoundResponse({ description: "Genre not found" })
  @ApiOperation({ summary: "Delete a custom genre of the current user" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  @JwtProtected()
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.genresService.delete(user.id, id);
  }
}
