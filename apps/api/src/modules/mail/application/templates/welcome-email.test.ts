import { describe, expect, it } from "vitest";

import { renderWelcomeEmail } from "./welcome-email.js";

const baseVars = {
  addBookUrl: "http://localhost:3000/books/create",
  dashboardUrl: "http://localhost:3000/dashboard",
  settingsUrl: "http://localhost:3000/settings",
  userName: "Марина",
};

describe("renderWelcomeEmail", () => {
  it("returns the subject, html and text", () => {
    const { html, subject, text } = renderWelcomeEmail(baseVars);

    expect(subject).toBe("Вітаємо в BookNest ✨");
    expect(typeof html).toBe("string");
    expect(typeof text).toBe("string");
  });

  it("interpolates the user name into the html and text", () => {
    const { html, text } = renderWelcomeEmail(baseVars);

    expect(html).toContain("Вітаємо, Марина ✨");
    expect(text).toContain("Вітаємо, Марина!");
  });

  it("references the inline logo via its cid in the html", () => {
    const { html } = renderWelcomeEmail(baseVars);

    expect(html).toContain('src="cid:booknest-logo"');
  });

  it("embeds the add-book, dashboard and settings urls in the html", () => {
    const { html } = renderWelcomeEmail(baseVars);

    expect(html).toContain(baseVars.addBookUrl);
    expect(html).toContain(baseVars.dashboardUrl);
    expect(html).toContain(baseVars.settingsUrl);
  });

  it("embeds the add-book, dashboard and settings urls in the text version", () => {
    const { text } = renderWelcomeEmail(baseVars);

    expect(text).toContain(baseVars.addBookUrl);
    expect(text).toContain(baseVars.dashboardUrl);
    expect(text).toContain(baseVars.settingsUrl);
  });

  it("escapes html metacharacters in the user name in the html output", () => {
    const userName = `<script>alert(1)</script> & "BookNest" 'reader'`;
    const { html } = renderWelcomeEmail({ ...baseVars, userName });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;BookNest&quot;");
    expect(html).toContain("&#39;reader&#39;");
  });

  it("keeps html metacharacters raw in the text output", () => {
    const userName = `<script>alert(1)</script> & "BookNest" 'reader'`;
    const { text } = renderWelcomeEmail({ ...baseVars, userName });

    expect(text).toContain(`Вітаємо, ${userName}!`);
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("&amp;");
  });
});
