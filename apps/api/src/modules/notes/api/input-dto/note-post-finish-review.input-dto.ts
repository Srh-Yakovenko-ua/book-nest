import { NotePostFinishReviewInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NotePostFinishReviewInputDto extends createZodDto(NotePostFinishReviewInputSchema) {}
