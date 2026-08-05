export type OutboundEmail = {
  attachments?: { cid: string; content: Buffer; filename: string }[];
  html: string;
  subject: string;
  text: string;
  to: string;
};

export abstract class MailPort {
  abstract send(message: OutboundEmail): Promise<void>;
}
