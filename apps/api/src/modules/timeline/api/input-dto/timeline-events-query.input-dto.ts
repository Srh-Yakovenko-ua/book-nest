import { TimelineEventsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineEventsQueryDto extends createZodDto(TimelineEventsQuerySchema) {}
