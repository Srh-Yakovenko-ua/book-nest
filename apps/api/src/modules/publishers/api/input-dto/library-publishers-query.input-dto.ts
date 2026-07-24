import { LibraryPublishersQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersQueryDto extends createZodDto(LibraryPublishersQuerySchema) {}
