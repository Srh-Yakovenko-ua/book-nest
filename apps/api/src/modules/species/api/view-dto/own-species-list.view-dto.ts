import { OwnSpeciesListSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class OwnSpeciesListDto extends createZodDto(OwnSpeciesListSchema) {}
