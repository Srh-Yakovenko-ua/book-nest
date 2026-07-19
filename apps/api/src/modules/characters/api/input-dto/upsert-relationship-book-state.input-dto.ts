import { UpsertRelationshipBookStateSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpsertRelationshipBookStateInputDto extends createZodDto(
  UpsertRelationshipBookStateSchema,
) {}
