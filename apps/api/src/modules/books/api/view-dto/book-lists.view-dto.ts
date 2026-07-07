import { BookListsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookListsViewDto extends createZodDto(BookListsViewSchema) {}
