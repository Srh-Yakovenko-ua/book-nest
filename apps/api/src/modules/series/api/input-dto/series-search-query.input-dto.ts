import { SeriesSearchQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesSearchQueryDto extends createZodDto(SeriesSearchQuerySchema) {}
