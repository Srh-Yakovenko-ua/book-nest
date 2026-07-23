import { LibraryPublishersPageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersPageDto extends createZodDto(LibraryPublishersPageSchema) {}
