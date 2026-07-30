import type { InterfaceLanguage, NotificationPayload, Nullable } from "@app/shared";

import type { ProviderOverride } from "./auth-test-context.js";

import { MailService } from "../modules/mail/application/mail.service.js";

export type DigestMailStub = {
  failNext: (error: Error) => void;
  override: ProviderOverride;
  reset: () => void;
  sent: SentDigest[];
};

export type SentDigest = {
  items: readonly NotificationPayload[];
  locale: InterfaceLanguage;
  to: string;
  userName: string;
};

export function createDigestMailStub(): DigestMailStub {
  const sent: SentDigest[] = [];
  let nextError: Nullable<Error> = null;

  return {
    failNext: (error: Error) => {
      nextError = error;
    },
    override: {
      provide: MailService,
      useValue: {
        sendNotificationDigestEmailOrThrow: (digest: SentDigest): Promise<void> => {
          if (nextError !== null) {
            const error = nextError;
            nextError = null;
            return Promise.reject(error);
          }
          sent.push(digest);
          return Promise.resolve();
        },
      },
    },
    reset: () => {
      sent.length = 0;
      nextError = null;
    },
    sent,
  };
}
