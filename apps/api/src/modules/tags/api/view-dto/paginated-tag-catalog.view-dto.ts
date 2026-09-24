import { PaginatedTagCatalogSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTagCatalogDto extends createZodDto(PaginatedTagCatalogSchema) {}
