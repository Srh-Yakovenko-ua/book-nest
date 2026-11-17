import { GenreViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenreViewDto extends createZodDto(GenreViewSchema) {}
