import { LibraryQuickCountsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryQuickCountsQueryDto extends createZodDto(LibraryQuickCountsQuerySchema) {}
