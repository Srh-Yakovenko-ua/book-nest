import { NoteDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NoteDeletionResultDto extends createZodDto(NoteDeletionResultSchema) {}
