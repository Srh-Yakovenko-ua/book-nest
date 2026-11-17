import { PaginatedDeliveryServicesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedDeliveryServicesDto extends createZodDto(PaginatedDeliveryServicesSchema) {}
