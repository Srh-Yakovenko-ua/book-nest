import { SeriesCharacterSummaryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharacterSummaryQueryDto extends createZodDto(
  SeriesCharacterSummaryQuerySchema,
) {}
