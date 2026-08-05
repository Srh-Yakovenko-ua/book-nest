import { PaginatedTrashedListsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashedListsDto extends createZodDto(PaginatedTrashedListsSchema) {}
