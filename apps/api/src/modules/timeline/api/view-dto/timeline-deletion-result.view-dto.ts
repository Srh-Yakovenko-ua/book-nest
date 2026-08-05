import { TimelineDeletionResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineDeletionResultDto extends createZodDto(TimelineDeletionResultSchema) {}
