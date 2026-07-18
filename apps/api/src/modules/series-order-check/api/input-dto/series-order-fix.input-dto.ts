import { SeriesOrderFixInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderFixInputDto extends createZodDto(SeriesOrderFixInputSchema) {}
