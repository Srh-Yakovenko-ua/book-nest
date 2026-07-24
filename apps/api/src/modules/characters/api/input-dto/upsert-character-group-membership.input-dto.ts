import { UpsertCharacterGroupMembershipSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpsertCharacterGroupMembershipInputDto extends createZodDto(
  UpsertCharacterGroupMembershipSchema,
) {}
