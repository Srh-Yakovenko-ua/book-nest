import { BookViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookViewDto extends createZodDto(BookViewSchema) {}
