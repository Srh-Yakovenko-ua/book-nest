import { MediaViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MediaViewDto extends createZodDto(MediaViewSchema) {}
