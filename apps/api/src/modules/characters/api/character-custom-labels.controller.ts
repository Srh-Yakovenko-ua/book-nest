import type { CharacterCustomLabelsView } from "@app/shared";

import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "../../auth/index.js";

import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { CharacterCustomLabelsService } from "../application/character-custom-labels.service.js";
import { CharacterCustomLabelsViewDto } from "./view-dto/character-custom-labels.view-dto.js";

@ApiTags("characters")
@Controller("api/character-custom-labels")
@JwtProtected()
export class CharacterCustomLabelsController {
  constructor(private readonly characterCustomLabelsService: CharacterCustomLabelsService) {}

  @ApiOkResponse({
    description:
      "The custom role and status labels already used across the user's books, merged case- and whitespace-insensitively, most used first, spoiler-flagged values excluded",
    type: CharacterCustomLabelsViewDto,
  })
  @ApiOperation({
    summary: "List the custom character roles and statuses the user has already typed",
  })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CharacterCustomLabelsView> {
    return this.characterCustomLabelsService.getCustomLabels({ userId: user.id });
  }
}
