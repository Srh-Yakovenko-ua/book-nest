import { InTransitFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitFacetsViewDto extends createZodDto(InTransitFacetsViewSchema) {}
