import { PaginatedBookCharacterRosterSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedBookCharacterRosterDto extends createZodDto(
  PaginatedBookCharacterRosterSchema,
) {}
