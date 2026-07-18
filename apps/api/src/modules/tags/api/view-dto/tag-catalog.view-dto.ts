import { TagCatalogViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TagCatalogViewDto extends createZodDto(TagCatalogViewSchema) {}
