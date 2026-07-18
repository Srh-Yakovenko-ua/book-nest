import { PaginatedTimelineEventsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTimelineEventsDto extends createZodDto(PaginatedTimelineEventsSchema) {}
