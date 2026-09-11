import { QuoteRediscoveryImpressionInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuoteRediscoveryImpressionInputDto extends createZodDto(
  QuoteRediscoveryImpressionInputSchema,
) {}
