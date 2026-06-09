import { describe, expect, it } from "vitest";

import { renderPasswordChanged } from "./password-changed.js";

const baseVars = {
  loginUrl: "http://localhost:3000/login",
  resetPasswordUrl: "http://localhost:3000/forgot-password",
  userName: "Марина",
};

describe("renderPasswordChanged", () => {
  it("returns the password changed subject", () => {
    const { subject } = renderPasswordChanged(baseVars);

    expect(subject).toBe("Пароль BookNest було змінено");
  });

  it("embeds the reset password url in the html and text", () => {
    const { html, text } = renderPasswordChanged(baseVars);

    expect(html).toContain(baseVars.resetPasswordUrl);
    expect(text).toContain(baseVars.resetPasswordUrl);
  });

  it("embeds the login url in the html and text", () => {
    const { html, text } = renderPasswordChanged(baseVars);

    expect(html).toContain(baseVars.loginUrl);
    expect(text).toContain(baseVars.loginUrl);
  });

  it("renders a BookNest header in the text", () => {
    const { text } = renderPasswordChanged(baseVars);

    expect(text).toContain("BookNest");
  });

  it("escapes html metacharacters in the user name in the html output", () => {
    const { html } = renderPasswordChanged({ ...baseVars, userName: "<b>x</b>" });

    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
