import { ChangelogListResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ChangelogListResponseDto extends createZodDto(ChangelogListResponseSchema) {}
