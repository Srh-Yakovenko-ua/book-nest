import { describe, expect, it } from "vitest";

import { renderPasswordReset } from "./password-reset.js";

const baseVars = {
  loginUrl: "http://localhost:3000/login",
  resetPasswordUrl: "http://localhost:3000/reset-password?token=raw-token",
  userName: "Марина",
};

describe("renderPasswordReset", () => {
  it("returns the reset subject", () => {
    const { subject } = renderPasswordReset(baseVars);

    expect(subject).toBe("Відновлення паролю BookNest");
  });

  it("embeds the reset password url in the html and text", () => {
    const { html, text } = renderPasswordReset(baseVars);

    expect(html).toContain(baseVars.resetPasswordUrl);
    expect(text).toContain(baseVars.resetPasswordUrl);
  });

  it("embeds the login url in the html and text", () => {
    const { html, text } = renderPasswordReset(baseVars);

    expect(html).toContain(baseVars.loginUrl);
    expect(text).toContain(baseVars.loginUrl);
  });

  it("renders a BookNest header in the text", () => {
    const { text } = renderPasswordReset(baseVars);

    expect(text).toContain("BookNest");
  });

  it("escapes html metacharacters in the user name in the html output", () => {
    const { html } = renderPasswordReset({ ...baseVars, userName: "<b>x</b>" });

    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
