import { describe, expect, it } from "vitest";

import { renderEmailVerification } from "./email-verification.js";

const baseVars = {
  expiresInMinutes: 60,
  userName: "Марина",
  verificationUrl: "http://localhost:3000/verify-email?token=raw-token",
};

describe("renderEmailVerification", () => {
  it("returns the subject, html and text", () => {
    const { html, subject, text } = renderEmailVerification(baseVars);

    expect(subject).toBe("Підтвердіть email для BookNest");
    expect(typeof html).toBe("string");
    expect(typeof text).toBe("string");
  });

  it("interpolates the user name into the html and text", () => {
    const { html, text } = renderEmailVerification(baseVars);

    expect(html).toContain("Вітаємо, Марина!");
    expect(text).toContain("Вітаємо, Марина!");
  });

  it("references the inline logo via its cid in the html", () => {
    const { html } = renderEmailVerification(baseVars);

    expect(html).toContain('src="cid:booknest-logo"');
  });

  it("embeds the verification url in the html and text", () => {
    const { html, text } = renderEmailVerification(baseVars);

    expect(html).toContain(baseVars.verificationUrl);
    expect(text).toContain(baseVars.verificationUrl);
  });

  it("states the link expiry in minutes in the html and text", () => {
    const { html, text } = renderEmailVerification(baseVars);

    expect(html).toContain("Посилання дійсне 60 хвилин.");
    expect(text).toContain("Посилання дійсне 60 хвилин.");
  });

  it("escapes html metacharacters in the user name in the html output", () => {
    const userName = `<script>alert(1)</script> & "BookNest" 'reader'`;
    const { html } = renderEmailVerification({ ...baseVars, userName });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;BookNest&quot;");
    expect(html).toContain("&#39;reader&#39;");
  });
});
