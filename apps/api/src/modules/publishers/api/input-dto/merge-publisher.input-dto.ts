import { MergePublisherInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MergePublisherDto extends createZodDto(MergePublisherInputSchema) {}
