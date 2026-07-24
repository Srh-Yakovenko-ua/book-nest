import { LibraryPublisherDetailQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublisherDetailQueryDto extends createZodDto(
  LibraryPublisherDetailQuerySchema,
) {}
