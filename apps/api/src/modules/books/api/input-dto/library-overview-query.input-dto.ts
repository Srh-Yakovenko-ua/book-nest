import { LibraryOverviewQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryOverviewQueryDto extends createZodDto(LibraryOverviewQuerySchema) {}
