import { BookFamilyTreeViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookFamilyTreeViewDto extends createZodDto(BookFamilyTreeViewSchema) {}
