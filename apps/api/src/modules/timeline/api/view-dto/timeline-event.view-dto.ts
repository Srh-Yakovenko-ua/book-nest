import { TimelineEventViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineEventViewDto extends createZodDto(TimelineEventViewSchema) {}
