import { CreateShipmentInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateShipmentInputDto extends createZodDto(CreateShipmentInputSchema) {}
