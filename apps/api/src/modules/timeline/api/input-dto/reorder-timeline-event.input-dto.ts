import { ReorderTimelineEventInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReorderTimelineEventInputDto extends createZodDto(ReorderTimelineEventInputSchema) {}
