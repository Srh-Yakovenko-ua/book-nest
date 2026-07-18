import { CreateTimelineInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTimelineInputDto extends createZodDto(CreateTimelineInputSchema) {}
