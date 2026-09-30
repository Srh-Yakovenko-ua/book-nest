import { PublisherDuplicateCandidatesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PublisherDuplicateCandidatesQueryDto extends createZodDto(
  PublisherDuplicateCandidatesQuerySchema,
) {}
