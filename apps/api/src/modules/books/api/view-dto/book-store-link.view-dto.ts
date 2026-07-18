import { BookStoreLinksViewSchema, BookStoreLinkViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookStoreLinksViewDto extends createZodDto(BookStoreLinksViewSchema) {}

export class BookStoreLinkViewDto extends createZodDto(BookStoreLinkViewSchema) {}
