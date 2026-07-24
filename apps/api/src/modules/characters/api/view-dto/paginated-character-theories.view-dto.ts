import { PaginatedCharacterTheoriesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterTheoriesDto extends createZodDto(PaginatedCharacterTheoriesSchema) {}
