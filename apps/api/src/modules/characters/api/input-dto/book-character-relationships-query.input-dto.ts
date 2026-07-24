import { BookCharacterRelationshipsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookCharacterRelationshipsQueryDto extends createZodDto(
  BookCharacterRelationshipsQuerySchema,
) {}
