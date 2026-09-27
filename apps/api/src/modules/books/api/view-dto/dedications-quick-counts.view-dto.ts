import { DedicationsQuickCountsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DedicationsQuickCountsViewDto extends createZodDto(DedicationsQuickCountsSchema) {}
