import { escapeHtml } from "./escape-html.js";

export type EmailVerificationVariables = {
  expiresInMinutes: number;
  userName: string;
  verificationUrl: string;
};

type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export function renderEmailVerification(vars: EmailVerificationVariables): RenderedEmail {
  const { expiresInMinutes, userName, verificationUrl } = vars;

  const subject = "Підтвердіть email для BookNest";

  const html = `<!DOCTYPE html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Підтвердіть email для BookNest</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FFF8F0; font-family:Arial, Helvetica, sans-serif; color:#2F241D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFF8F0; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
      <tr><td align="center" style="font-family:Arial, Helvetica, sans-serif;">
        <!--[if mso]><table role="presentation" align="center" width="640" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(96, 60, 32, 0.12); font-family:Arial, Helvetica, sans-serif;">
          <tr><td style="padding:32px 32px 20px; text-align:center; background:linear-gradient(135deg, #FFF1DC 0%, #FFE2BF 100%); font-family:Arial, Helvetica, sans-serif;">
            <img src="cid:booknest-logo" alt="BookNest" width="200" style="display:block; margin:0 auto; max-width:200px; height:auto;" />
            <div style="margin-top:12px; font-size:15px; line-height:1.5; color:#7A5738;">Підтвердження email-адреси</div>
          </td></tr>
          <tr><td style="padding:36px 32px 24px; font-family:Arial, Helvetica, sans-serif;">
            <h1 style="margin:0 0 16px; font-size:28px; line-height:1.25; color:#2F241D;">Підтвердіть ваш email</h1>
            <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#4A3A2E;">Вітаємо, ${escapeHtml(userName)}!</p>
            <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#4A3A2E;">Дякуємо за реєстрацію в <strong>BookNest</strong>. Щоб завершити налаштування акаунту, підтвердіть вашу email-адресу.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;"><tr>
              <td align="center" bgcolor="#D97706" style="border-radius:14px; padding:14px 24px;">
                <a href="${verificationUrl}" target="_blank" style="display:inline-block; font-size:16px; line-height:1.2; color:#FFFFFF; text-decoration:none; font-weight:700; font-family:Arial, Helvetica, sans-serif;">Підтвердити email</a>
              </td>
            </tr></table>
            <div style="padding:20px; background-color:#FFF8F0; border-radius:18px; border:1px solid #F4E1C7;">
              <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A3218; font-weight:700;">Навіщо це потрібно?</p>
              <p style="margin:0; font-size:15px; line-height:1.7; color:#4A3A2E;">Підтвердження email допомагає захистити ваш акаунт і переконатися, що саме ви маєте доступ до цієї адреси.</p>
              <p style="margin:12px 0 0; font-size:14px; line-height:1.6; color:#7A5738;">Посилання дійсне ${expiresInMinutes} хвилин.</p>
            </div>
            <p style="margin:24px 0 0; font-size:15px; line-height:1.7; color:#4A3A2E;">Після підтвердження ви зможете повноцінно користуватися BookNest: додавати книги, створювати списки, зберігати нотатки й цитати.</p>
          </td></tr>
          <tr><td style="padding:24px 32px 32px; border-top:1px solid #F4E1C7; font-family:Arial, Helvetica, sans-serif;">
            <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">Цей лист надіслано, тому що ви створили акаунт у BookNest.</p>
            <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
            <p style="margin:0 0 16px; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${verificationUrl}" target="_blank" style="color:#D97706;">${verificationUrl}</a></p>
            <p style="margin:0; font-size:13px; line-height:1.6; color:#9A7B5F;">© BookNest. Your personal reading space.</p>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Підтвердіть email для BookNest

Вітаємо, ${userName}!

Дякуємо за реєстрацію в BookNest. Щоб завершити налаштування акаунту, підтвердіть вашу email-адресу.

Підтвердити email:
${verificationUrl}

Посилання дійсне ${expiresInMinutes} хвилин.

Підтвердження email допомагає захистити ваш акаунт і переконатися, що саме ви маєте доступ до цієї адреси.

Якщо ви не створювали акаунт у BookNest, просто проігноруйте цей лист.

© BookNest. Your personal reading space.`;

  return { html, subject, text };
}
