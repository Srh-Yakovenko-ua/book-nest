import { BookCharacterSummaryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharacterSummaryQueryDto extends createZodDto(BookCharacterSummaryQuerySchema) {}
