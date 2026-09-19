import { NoteRediscoveryImpressionInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NoteRediscoveryImpressionInputDto extends createZodDto(
  NoteRediscoveryImpressionInputSchema,
) {}
