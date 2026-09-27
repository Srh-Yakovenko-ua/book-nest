import { GenreSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenreSummaryViewDto extends createZodDto(GenreSummaryViewSchema) {}
