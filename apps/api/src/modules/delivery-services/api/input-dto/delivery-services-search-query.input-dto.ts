import { TaxonomySearchPaginationQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeliveryServicesSearchQueryDto extends createZodDto(
  TaxonomySearchPaginationQuerySchema,
) {}
