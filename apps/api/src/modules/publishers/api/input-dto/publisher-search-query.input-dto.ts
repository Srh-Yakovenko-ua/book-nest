import { PublisherSearchPaginationQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PublisherSearchPaginationQueryDto extends createZodDto(
  PublisherSearchPaginationQuerySchema,
) {}
