import { MoveTimelineEventInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MoveTimelineEventInputDto extends createZodDto(MoveTimelineEventInputSchema) {}
