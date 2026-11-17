import { PaginatedTagsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTagsDto extends createZodDto(PaginatedTagsSchema) {}
