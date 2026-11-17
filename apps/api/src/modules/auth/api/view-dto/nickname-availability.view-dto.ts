import { NicknameAvailabilityViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NicknameAvailabilityViewDto extends createZodDto(NicknameAvailabilityViewSchema) {}
