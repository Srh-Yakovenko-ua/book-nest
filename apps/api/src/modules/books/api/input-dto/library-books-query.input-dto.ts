import { LibraryBooksQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryBooksQueryDto extends createZodDto(LibraryBooksQuerySchema) {}
