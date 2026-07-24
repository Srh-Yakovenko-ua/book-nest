import { SeriesCharacterSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesCharacterSummaryViewDto extends createZodDto(SeriesCharacterSummaryViewSchema) {}
