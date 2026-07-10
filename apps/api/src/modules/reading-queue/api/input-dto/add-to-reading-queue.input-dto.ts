import { AddToReadingQueueInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class AddToReadingQueueInputDto extends createZodDto(AddToReadingQueueInputSchema) {}
