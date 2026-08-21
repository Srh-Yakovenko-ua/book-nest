import { PaginatedOrderHistoryGroupsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedOrderHistoryGroupsDto extends createZodDto(
  PaginatedOrderHistoryGroupsSchema,
) {}
