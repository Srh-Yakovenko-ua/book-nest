import { ChangelogListQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ChangelogListQueryDto extends createZodDto(ChangelogListQuerySchema) {}
