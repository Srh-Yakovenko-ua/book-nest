import { GenresQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenresQueryDto extends createZodDto(GenresQuerySchema) {}
