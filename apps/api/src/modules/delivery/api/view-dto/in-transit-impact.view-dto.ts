import { InTransitImpactViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitImpactViewDto extends createZodDto(InTransitImpactViewSchema) {}
