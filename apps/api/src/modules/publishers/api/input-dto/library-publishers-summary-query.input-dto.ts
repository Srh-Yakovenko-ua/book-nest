import { LibraryPublishersSummaryQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersSummaryQueryDto extends createZodDto(
  LibraryPublishersSummaryQuerySchema,
) {}
