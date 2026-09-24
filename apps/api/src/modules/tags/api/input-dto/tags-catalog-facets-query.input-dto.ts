import { TagsCatalogFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagsCatalogFacetsQueryDto extends createZodDto(TagsCatalogFacetsQuerySchema) {}
