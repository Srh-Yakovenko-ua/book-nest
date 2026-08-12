import { BookFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookFacetsViewDto extends createZodDto(BookFacetsViewSchema) {}
