import { TimelineViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineViewDto extends createZodDto(TimelineViewSchema) {}
