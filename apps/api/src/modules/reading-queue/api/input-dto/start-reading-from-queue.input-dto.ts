import { StartReadingFromQueueInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class StartReadingFromQueueInputDto extends createZodDto(StartReadingFromQueueInputSchema) {}
