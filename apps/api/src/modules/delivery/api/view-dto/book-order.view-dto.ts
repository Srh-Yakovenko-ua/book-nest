import { BookOrderViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderViewDto extends createZodDto(BookOrderViewSchema) {}
