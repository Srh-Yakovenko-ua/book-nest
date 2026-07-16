import { UpdateTimelineEventInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateTimelineEventInputDto extends createZodDto(UpdateTimelineEventInputSchema) {}
