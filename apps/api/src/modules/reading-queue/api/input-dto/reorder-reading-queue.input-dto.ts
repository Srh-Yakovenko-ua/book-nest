import { ReorderReadingQueueInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReorderReadingQueueInputDto extends createZodDto(ReorderReadingQueueInputSchema) {}
