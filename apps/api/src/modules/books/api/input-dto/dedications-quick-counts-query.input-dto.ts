import { DedicationsQuickCountsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DedicationsQuickCountsQueryDto extends createZodDto(
  DedicationsQuickCountsQuerySchema,
) {}
