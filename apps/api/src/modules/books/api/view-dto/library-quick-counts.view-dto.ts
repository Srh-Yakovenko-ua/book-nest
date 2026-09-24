import { LibraryQuickCountsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryQuickCountsViewDto extends createZodDto(LibraryQuickCountsSchema) {}
