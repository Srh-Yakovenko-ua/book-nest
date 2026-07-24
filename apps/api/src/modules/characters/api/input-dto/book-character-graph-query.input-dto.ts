import { BookCharacterGraphQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharacterGraphQueryDto extends createZodDto(BookCharacterGraphQuerySchema) {}
