import { PaginatedCharacterFactsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterFactsDto extends createZodDto(PaginatedCharacterFactsSchema) {}
