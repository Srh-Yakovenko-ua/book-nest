import { RecentPublishersQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RecentPublishersQueryDto extends createZodDto(RecentPublishersQuerySchema) {}
