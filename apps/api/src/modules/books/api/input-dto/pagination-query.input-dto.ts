import { PaginationQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}
