import { SeriesCharacterRelationshipsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharacterRelationshipsQueryDto extends createZodDto(
  SeriesCharacterRelationshipsQuerySchema,
) {}
