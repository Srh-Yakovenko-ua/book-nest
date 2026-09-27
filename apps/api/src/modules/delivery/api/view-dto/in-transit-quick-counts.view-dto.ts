import { InTransitQuickCountsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitQuickCountsViewDto extends createZodDto(InTransitQuickCountsSchema) {}
