import { SeriesCharacterProfileQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharacterProfileQueryDto extends createZodDto(
  SeriesCharacterProfileQuerySchema,
) {}
