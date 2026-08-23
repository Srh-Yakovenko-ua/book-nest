import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { LoanContactNameButton } from "./loan-contact-name-button";

const openContactLabel = (name: string): string =>
  messages.loans.contactDrawer.openContact.replace("{name}", name);

describe("LoanContactNameButton", () => {
  it("puts the contact details inside the same clickable entity", () => {
    renderWithProviders(
      <LoanContactNameButton
        contact="+380 67 123 45 67"
        layout="block"
        name="Андрій"
        onOpen={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: openContactLabel("Андрій") });
    expect(within(trigger).getByText("Андрій")).toBeInTheDocument();
    expect(within(trigger).getByText("+380 67 123 45 67")).toBeInTheDocument();
    expect(trigger).toHaveAccessibleDescription("+380 67 123 45 67");
  });

  it("shows only the name when there is nothing to call", () => {
    renderWithProviders(
      <LoanContactNameButton contact={null} layout="block" name="Софія" onOpen={vi.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: openContactLabel("Софія") });
    expect(within(trigger).getByText("Софія")).toBeInTheDocument();
    expect(trigger).not.toHaveAccessibleDescription();
  });

  it("opens the person card from the keyboard", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(
      <LoanContactNameButton
        contact="olena@example.com"
        layout="block"
        name="Олена"
        onOpen={onOpen}
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: openContactLabel("Олена") })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("keeps the inline layout a plain name trigger", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<LoanContactNameButton name="Петро" onOpen={onOpen} />);

    const trigger = screen.getByRole("button", { name: openContactLabel("Петро") });
    expect(trigger).toHaveTextContent("Петро");

    await user.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
