import { DeleteTimelineQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DeleteTimelineQueryDto extends createZodDto(DeleteTimelineQuerySchema) {}
