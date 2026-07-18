import { PaginatedCharacterSummarySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharactersDto extends createZodDto(PaginatedCharacterSummarySchema) {}
