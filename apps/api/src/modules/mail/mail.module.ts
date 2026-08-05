import { Module } from "@nestjs/common";

import { MailService } from "./application/mail.service.js";
import { MailPort } from "./domain/mail.port.js";
import { NodemailerMailAdapter } from "./infrastructure/nodemailer-mail.adapter.js";

@Module({
  exports: [MailService],
  providers: [MailService, { provide: MailPort, useClass: NodemailerMailAdapter }],
})
export class MailModule {}
