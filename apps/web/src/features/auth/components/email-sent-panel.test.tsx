import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { EmailSentPanel } from "./email-sent-panel";

const forgot = messages.auth.forgot;

function showPanel() {
  renderWithProviders(
    <EmailSentPanel
      cooldownSeconds={0}
      hint={forgot.sentHint}
      lead="reader@example.com"
      onResend={vi.fn()}
      resendPending={false}
      title={forgot.sentTitle}
    />,
  );
}

describe("EmailSentPanel illustration", () => {
  it("shows the email-sent art", () => {
    showPanel();

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("email-sent.png"),
    );
  });

  it("places the email-sent art above the heading", () => {
    showPanel();

    const heading = screen.getByRole("heading", { name: forgot.sentTitle });
    expect(screen.getByRole("presentation").compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
