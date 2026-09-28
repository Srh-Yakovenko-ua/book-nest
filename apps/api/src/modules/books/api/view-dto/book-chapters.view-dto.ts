import { BookChaptersViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookChaptersViewDto extends createZodDto(BookChaptersViewSchema) {}
