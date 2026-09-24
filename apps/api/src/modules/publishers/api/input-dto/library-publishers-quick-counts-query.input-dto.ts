import { LibraryPublishersQuickCountsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersQuickCountsQueryDto extends createZodDto(
  LibraryPublishersQuickCountsQuerySchema,
) {}
