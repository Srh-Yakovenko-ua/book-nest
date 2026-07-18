import { BookQuotesViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookQuotesViewDto extends createZodDto(BookQuotesViewSchema) {}
