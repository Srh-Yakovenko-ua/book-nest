import { SeriesOrderCheckPreferenceInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderCheckPreferenceInputDto extends createZodDto(
  SeriesOrderCheckPreferenceInputSchema,
) {}
