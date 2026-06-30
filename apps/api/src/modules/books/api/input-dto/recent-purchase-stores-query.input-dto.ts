import { RecentPurchaseStoresQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RecentPurchaseStoresQueryDto extends createZodDto(RecentPurchaseStoresQuerySchema) {}
