import { PublisherDuplicateCandidateSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PublisherDuplicateCandidateDto extends createZodDto(
  PublisherDuplicateCandidateSchema,
) {}
