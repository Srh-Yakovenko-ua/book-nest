import { GenreStatsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenreStatsViewDto extends createZodDto(GenreStatsViewSchema) {}
