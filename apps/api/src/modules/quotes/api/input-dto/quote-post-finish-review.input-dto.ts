import { QuotePostFinishReviewInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotePostFinishReviewInputDto extends createZodDto(QuotePostFinishReviewInputSchema) {}
