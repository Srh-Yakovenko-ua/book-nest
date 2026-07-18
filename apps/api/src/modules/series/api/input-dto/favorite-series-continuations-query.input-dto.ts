import { FavoriteSeriesContinuationsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class FavoriteSeriesContinuationsQueryDto extends createZodDto(
  FavoriteSeriesContinuationsQuerySchema,
) {}
