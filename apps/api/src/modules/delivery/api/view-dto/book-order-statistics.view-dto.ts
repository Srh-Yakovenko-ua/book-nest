import { BookOrderStatisticsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderStatisticsViewDto extends createZodDto(BookOrderStatisticsViewSchema) {}
