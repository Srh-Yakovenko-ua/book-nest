import { InTransitQuickCountsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitQuickCountsQueryDto extends createZodDto(InTransitQuickCountsQuerySchema) {}
