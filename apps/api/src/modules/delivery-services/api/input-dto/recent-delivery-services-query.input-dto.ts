import { RecentDeliveryServicesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RecentDeliveryServicesQueryDto extends createZodDto(
  RecentDeliveryServicesQuerySchema,
) {}
