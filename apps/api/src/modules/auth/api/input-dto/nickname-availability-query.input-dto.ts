import { NicknameAvailabilityQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NicknameAvailabilityQueryDto extends createZodDto(NicknameAvailabilityQuerySchema) {}
