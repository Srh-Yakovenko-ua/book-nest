import { LibraryPublishersQuickCountsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersQuickCountsDto extends createZodDto(
  LibraryPublishersQuickCountsSchema,
) {}
