import { PaginatedDeliveriesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedDeliveriesDto extends createZodDto(PaginatedDeliveriesSchema) {}
