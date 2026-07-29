import { PaginatedTrashedSeriesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashedSeriesDto extends createZodDto(PaginatedTrashedSeriesSchema) {}
