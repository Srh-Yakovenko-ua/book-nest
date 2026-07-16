import { SeriesOrderPreferenceViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderPreferenceViewDto extends createZodDto(SeriesOrderPreferenceViewSchema) {}
