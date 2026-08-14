import { PaginatedBookOrderItemRowsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedBookOrderItemRowsDto extends createZodDto(PaginatedBookOrderItemRowsSchema) {}
