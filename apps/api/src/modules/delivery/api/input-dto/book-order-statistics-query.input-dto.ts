import { BookOrderStatisticsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderStatisticsQueryDto extends createZodDto(BookOrderStatisticsQuerySchema) {}
