import { RecentAuthorsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RecentAuthorsQueryDto extends createZodDto(RecentAuthorsQuerySchema) {}
