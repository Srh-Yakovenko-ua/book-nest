import { ApplySeriesOrderFixResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ApplySeriesOrderFixResponseDto extends createZodDto(
  ApplySeriesOrderFixResponseSchema,
) {}
