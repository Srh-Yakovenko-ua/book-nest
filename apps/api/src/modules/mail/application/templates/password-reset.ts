import type { RenderedEmail } from "./rendered-email.js";

import { escapeHtml } from "./escape-html.js";

export type PasswordResetVariables = {
  loginUrl: string;
  resetPasswordUrl: string;
  userName: string;
};

export function renderPasswordReset(vars: PasswordResetVariables): RenderedEmail {
  const { loginUrl, resetPasswordUrl, userName } = vars;

  const subject = "Відновлення паролю BookNest";

  const html = `<!DOCTYPE html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Відновлення паролю BookNest</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FFF8F0; font-family:Arial, Helvetica, sans-serif; color:#2F241D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFF8F0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(96, 60, 32, 0.12);">
            <tr>
              <td style="padding:32px 32px 20px; text-align:center; background:linear-gradient(135deg, #FFF1DC 0%, #FFE2BF 100%);">
                <div style="font-size:32px; line-height:1.2; font-weight:700; color:#5A3218;">BookNest</div>
                <div style="margin-top:8px; font-size:15px; line-height:1.5; color:#7A5738;">Відновлення доступу до акаунту</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 24px;">
                <h1 style="margin:0 0 16px; font-size:28px; line-height:1.25; color:#2F241D;">Відновлення паролю</h1>
                <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#4A3A2E;">${escapeHtml(userName)}, ми отримали запит на зміну паролю для вашого акаунту BookNest.</p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#4A3A2E;">Щоб створити новий пароль, натисніть кнопку нижче.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="#D97706" style="border-radius:14px;">
                      <a href="${resetPasswordUrl}" target="_blank" style="display:inline-block; padding:14px 24px; font-size:16px; line-height:1.2; color:#FFFFFF; text-decoration:none; font-weight:700; border-radius:14px;">Змінити пароль</a>
                    </td>
                  </tr>
                </table>
                <div style="padding:20px; background-color:#FFF8F0; border-radius:18px; border:1px solid #F4E1C7;">
                  <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A3218; font-weight:700;">Важливо</p>
                  <p style="margin:0; font-size:15px; line-height:1.7; color:#4A3A2E;">Посилання для відновлення паролю діє обмежений час. Якщо ви не запитували зміну паролю, просто проігноруйте цей лист — ваш пароль не буде змінено.</p>
                </div>
                <p style="margin:24px 0 0; font-size:15px; line-height:1.7; color:#4A3A2E;">Якщо ви згадали пароль, можете повернутися до сторінки входу:</p>
                <p style="margin:8px 0 0; font-size:15px; line-height:1.7;"><a href="${loginUrl}" target="_blank" style="color:#D97706; text-decoration:underline;">Увійти в BookNest</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px; border-top:1px solid #F4E1C7;">
                <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">Цей лист надіслано, тому що був запит на відновлення паролю для акаунту BookNest.</p>
                <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
                <p style="margin:0 0 16px; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${resetPasswordUrl}" target="_blank" style="color:#D97706;">${resetPasswordUrl}</a></p>
                <p style="margin:0; font-size:13px; line-height:1.6; color:#9A7B5F;">© BookNest. Your personal reading space.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Відновлення паролю BookNest

${userName}, ми отримали запит на зміну паролю для вашого акаунту BookNest.

Щоб створити новий пароль, перейдіть за посиланням:
${resetPasswordUrl}

Посилання для відновлення паролю діє обмежений час.

Якщо ви не запитували зміну паролю, просто проігноруйте цей лист. Ваш пароль не буде змінено.

Повернутися до сторінки входу:
${loginUrl}

© BookNest. Your personal reading space.`;

  return { html, subject, text };
}
