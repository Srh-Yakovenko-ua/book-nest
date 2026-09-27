import { PaginatedGenreStatsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedGenreStatsDto extends createZodDto(PaginatedGenreStatsSchema) {}
