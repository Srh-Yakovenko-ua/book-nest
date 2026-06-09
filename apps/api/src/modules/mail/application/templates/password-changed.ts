import { escapeHtml } from "./escape-html.js";

export type PasswordChangedVariables = {
  loginUrl: string;
  resetPasswordUrl: string;
  userName: string;
};

type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export function renderPasswordChanged(vars: PasswordChangedVariables): RenderedEmail {
  const { loginUrl, resetPasswordUrl, userName } = vars;

  const subject = "Пароль BookNest було змінено";

  const html = `<!DOCTYPE html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Пароль BookNest було змінено</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FFF8F0; font-family:Arial, Helvetica, sans-serif; color:#2F241D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFF8F0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 12px 32px rgba(96, 60, 32, 0.12);">
            <tr>
              <td style="padding:32px 32px 20px; text-align:center; background:linear-gradient(135deg, #FFF1DC 0%, #FFE2BF 100%);">
                <div style="font-size:32px; line-height:1.2; font-weight:700; color:#5A3218;">BookNest</div>
                <div style="margin-top:8px; font-size:15px; line-height:1.5; color:#7A5738;">Повідомлення безпеки</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 24px;">
                <h1 style="margin:0 0 16px; font-size:28px; line-height:1.25; color:#2F241D;">Пароль змінено</h1>
                <p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#4A3A2E;">Вітаємо, ${escapeHtml(userName)}!</p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#4A3A2E;">Пароль до вашого акаунту BookNest було успішно змінено.</p>
                <div style="padding:20px; background-color:#FFF8F0; border-radius:18px; border:1px solid #F4E1C7;">
                  <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A3218; font-weight:700;">Це були ви?</p>
                  <p style="margin:0; font-size:15px; line-height:1.7; color:#4A3A2E;">Якщо ви самостійно змінили пароль — додаткових дій не потрібно.</p>
                </div>
                <div style="margin-top:18px; padding:20px; background-color:#FFF3F0; border-radius:18px; border:1px solid #FFD1C7;">
                  <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#8A2F1A; font-weight:700;">Це були не ви?</p>
                  <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#5A3218;">Якщо ви не змінювали пароль, радимо негайно відновити доступ до акаунту та змінити пароль ще раз.</p>
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" bgcolor="#D97706" style="border-radius:14px;">
                        <a href="${resetPasswordUrl}" target="_blank" style="display:inline-block; padding:14px 24px; font-size:16px; line-height:1.2; color:#FFFFFF; text-decoration:none; font-weight:700; border-radius:14px;">Захистити акаунт</a>
                      </td>
                    </tr>
                  </table>
                </div>
                <p style="margin:24px 0 0; font-size:15px; line-height:1.7; color:#4A3A2E;">Повернутися до сторінки входу:</p>
                <p style="margin:8px 0 0; font-size:15px; line-height:1.7;"><a href="${loginUrl}" target="_blank" style="color:#D97706; text-decoration:underline;">Увійти в BookNest</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px; border-top:1px solid #F4E1C7;">
                <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#7A5738;">Цей лист надіслано як повідомлення безпеки для вашого акаунту BookNest.</p>
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

  const text = `Пароль BookNest було змінено

Вітаємо, ${userName}!

Пароль до вашого акаунту BookNest було успішно змінено.

Якщо ви самостійно змінили пароль — додаткових дій не потрібно.

Якщо це були не ви, радимо негайно відновити доступ до акаунту та змінити пароль ще раз:
${resetPasswordUrl}

Повернутися до сторінки входу:
${loginUrl}

Цей лист надіслано як повідомлення безпеки для вашого акаунту BookNest.

© BookNest. Your personal reading space.`;

  return { html, subject, text };
}
