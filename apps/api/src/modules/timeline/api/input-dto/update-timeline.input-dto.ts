import { UpdateTimelineInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateTimelineInputDto extends createZodDto(UpdateTimelineInputSchema) {}
