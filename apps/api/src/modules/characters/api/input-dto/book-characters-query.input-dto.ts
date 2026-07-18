import { BookCharactersQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharactersQueryDto extends createZodDto(BookCharactersQuerySchema) {}
