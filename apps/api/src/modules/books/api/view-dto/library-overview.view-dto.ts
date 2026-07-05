import { LibraryOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryOverviewViewDto extends createZodDto(LibraryOverviewViewSchema) {}
