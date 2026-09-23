import { GenreFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenreFacetsViewDto extends createZodDto(GenreFacetsViewSchema) {}
