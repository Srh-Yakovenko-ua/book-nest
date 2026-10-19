import { BookDetailsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookDetailsViewDto extends createZodDto(BookDetailsViewSchema) {}
