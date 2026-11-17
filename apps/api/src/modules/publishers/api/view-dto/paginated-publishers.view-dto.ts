import { PaginatedPublishersSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedPublishersDto extends createZodDto(PaginatedPublishersSchema) {}
