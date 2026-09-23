import { LibraryPublisherOverviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class LibraryPublisherOverviewDto extends createZodDto(LibraryPublisherOverviewSchema) {}
