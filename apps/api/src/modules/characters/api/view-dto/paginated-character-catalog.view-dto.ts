import { PaginatedCharacterCatalogSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCharacterCatalogDto extends createZodDto(PaginatedCharacterCatalogSchema) {}
