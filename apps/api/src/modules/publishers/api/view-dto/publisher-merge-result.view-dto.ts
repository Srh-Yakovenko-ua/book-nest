import { PublisherMergeResultSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PublisherMergeResultDto extends createZodDto(PublisherMergeResultSchema) {}
