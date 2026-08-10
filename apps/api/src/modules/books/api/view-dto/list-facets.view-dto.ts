import { ListFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ListFacetsViewDto extends createZodDto(ListFacetsViewSchema) {}
