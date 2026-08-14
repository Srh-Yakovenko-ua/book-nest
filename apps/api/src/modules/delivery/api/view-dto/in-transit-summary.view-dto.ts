import { InTransitSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitSummaryViewDto extends createZodDto(InTransitSummaryViewSchema) {}
