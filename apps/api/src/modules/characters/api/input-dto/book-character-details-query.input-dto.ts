import { BookCharacterDetailsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharacterDetailsQueryDto extends createZodDto(BookCharacterDetailsQuerySchema) {}
