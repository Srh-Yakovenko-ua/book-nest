import { TimelineEventDetailViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineEventDetailViewDto extends createZodDto(TimelineEventDetailViewSchema) {}
