import { PublisherViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PublisherViewDto extends createZodDto(PublisherViewSchema) {}
