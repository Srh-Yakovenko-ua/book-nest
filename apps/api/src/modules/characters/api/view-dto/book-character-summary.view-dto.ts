import { BookCharacterSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharacterSummaryViewDto extends createZodDto(BookCharacterSummaryViewSchema) {}
