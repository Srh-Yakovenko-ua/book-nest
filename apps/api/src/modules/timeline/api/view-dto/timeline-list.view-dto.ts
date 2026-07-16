import { TimelineListViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineListViewDto extends createZodDto(TimelineListViewSchema) {}
