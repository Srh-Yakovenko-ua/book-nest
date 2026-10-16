import { TimelineLocationsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineLocationsViewDto extends createZodDto(TimelineLocationsViewSchema) {}
