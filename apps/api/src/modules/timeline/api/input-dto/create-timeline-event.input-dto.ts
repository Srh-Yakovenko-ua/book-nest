import { CreateTimelineEventInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTimelineEventInputDto extends createZodDto(CreateTimelineEventInputSchema) {}
