import type { InterfaceLanguage, NotificationPayload } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";

import type { DigestCopy } from "./notification-digest.copy.js";
import type { RenderedEmail } from "./rendered-email.js";

import { assertNever } from "../../../../core/assert-never.js";
import { escapeHtml } from "./escape-html.js";
import { DIGEST_COPY } from "./notification-digest.copy.js";

export type NotificationDigestVariables = {
  dashboardUrl: string;
  items: readonly NotificationPayload[];
  locale: InterfaceLanguage;
  userName: string;
};

export function renderNotificationDigest(vars: NotificationDigestVariables): RenderedEmail {
  const { dashboardUrl, items, locale, userName } = vars;
  const copy = DIGEST_COPY[locale];
  const lines = items.map((payload) => renderDigestLine({ copy, payload }));

  const listItems = lines
    .map(
      (line) =>
        `<li style="margin:0 0 10px; font-size:16px; line-height:1.7; color:#4A3A2E;">${escapeHtml(line)}</li>`,
    )
    .join("\n              ");

  const html = `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(copy.title)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FFF8F0; font-family:Arial, Helvetica, sans-serif; color:#2F241D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFF8F0; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
      <tr><td align="center" style="font-family:Arial, Helvetica, sans-serif;">
        <!--[if mso]><table role="presentation" align="center" width="640" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(96, 60, 32, 0.12); font-family:Arial, Helvetica, sans-serif;">
          <tr><td style="padding:32px 32px 20px; text-align:center; background:linear-gradient(135deg, #FFF1DC 0%, #FFE2BF 100%); font-family:Arial, Helvetica, sans-serif;">
            <img src="cid:booknest-logo" alt="BookNest" width="200" style="display:block; margin:0 auto; max-width:200px; height:auto;" />
          </td></tr>
          <tr><td style="padding:36px 32px 24px; font-family:Arial, Helvetica, sans-serif;">
            <h1 style="margin:0 0 16px; font-size:26px; line-height:1.25; color:#2F241D;">${escapeHtml(copy.greeting(userName))}</h1>
            <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#4A3A2E;">${escapeHtml(copy.intro)}</p>
            <ul style="margin:0 0 28px; padding-left:20px;">
              ${listItems}
            </ul>
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td align="center" bgcolor="#D97706" style="border-radius:14px; padding:14px 24px;">
                <a href="${dashboardUrl}" target="_blank" style="display:inline-block; font-size:16px; line-height:1.2; color:#FFFFFF; text-decoration:none; font-weight:700; font-family:Arial, Helvetica, sans-serif;">${escapeHtml(copy.linkLabel)}</a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:24px 32px 32px; border-top:1px solid #F4E1C7; font-family:Arial, Helvetica, sans-serif;">
            <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">${escapeHtml(copy.footer)}</p>
            <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${dashboardUrl}" target="_blank" style="color:#D97706;">${dashboardUrl}</a></p>
            <p style="margin:18px 0 0; font-size:13px; line-height:1.6; color:#9A7B5F;">© BookNest. Your personal reading space.</p>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${copy.greeting(userName)}

${copy.intro}

${lines.map((line) => `- ${line}`).join("\n")}

${copy.linkLabel}: ${dashboardUrl}

${copy.footer}

© BookNest. Your personal reading space.`;

  return { html, subject: copy.subject, text };
}

function renderDigestLine({
  copy,
  payload,
}: {
  copy: DigestCopy;
  payload: NotificationPayload;
}): string {
  switch (payload.type) {
    case NOTIFICATION_TYPES.deliveryArrivingSoon:
      return copy.deliveryArrivingSoon(payload);
    case NOTIFICATION_TYPES.deliveryArrivingToday:
      return copy.deliveryArrivingToday(payload);
    case NOTIFICATION_TYPES.deliveryDelayed:
      return copy.deliveryDelayed(payload);
    case NOTIFICATION_TYPES.loanDueSoon:
      return copy.loanDueSoon(payload);
    case NOTIFICATION_TYPES.loanDueToday:
      return copy.loanDueToday(payload);
    case NOTIFICATION_TYPES.loanOverdue:
      return copy.loanOverdue(payload);
    case NOTIFICATION_TYPES.systemTest:
      return copy.systemTest(payload);
    default:
      return assertNever(payload);
  }
}
