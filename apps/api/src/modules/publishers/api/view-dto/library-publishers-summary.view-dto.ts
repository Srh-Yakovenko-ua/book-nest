import { LibraryPublishersSummarySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublishersSummaryDto extends createZodDto(LibraryPublishersSummarySchema) {}
