import { BookFamilyTreeQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookFamilyTreeQueryDto extends createZodDto(BookFamilyTreeQuerySchema) {}
