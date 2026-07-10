import { PaginatedCustomListsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedCustomListsDto extends createZodDto(PaginatedCustomListsSchema) {}
