import { TaxonomySearchPaginationQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TaxonomySearchPaginationQueryDto extends createZodDto(
  TaxonomySearchPaginationQuerySchema,
) {}
