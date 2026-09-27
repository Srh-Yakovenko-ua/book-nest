import { GenresOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenresOverviewViewDto extends createZodDto(GenresOverviewViewSchema) {}
