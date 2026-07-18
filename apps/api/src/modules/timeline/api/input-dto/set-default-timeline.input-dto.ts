import { SetDefaultTimelineInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SetDefaultTimelineInputDto extends createZodDto(SetDefaultTimelineInputSchema) {}
