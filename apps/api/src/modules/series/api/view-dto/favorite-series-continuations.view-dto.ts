import { FavoriteSeriesContinuationsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class FavoriteSeriesContinuationsViewDto extends createZodDto(
  FavoriteSeriesContinuationsViewSchema,
) {}
