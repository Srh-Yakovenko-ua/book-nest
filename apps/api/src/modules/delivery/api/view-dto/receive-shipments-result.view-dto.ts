import { ReceiveShipmentsResultViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReceiveShipmentsResultViewDto extends createZodDto(ReceiveShipmentsResultViewSchema) {}
