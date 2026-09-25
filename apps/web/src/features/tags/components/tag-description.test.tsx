import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { TagDescription } from "./tag-description";

const DESCRIPTION = "Похмура, гнітюча атмосфера: сірі міста під дощем і довгі зими.";

let restoreMetrics: () => void = () => undefined;

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("TagDescription", () => {
  it("shows the full text in a tooltip when the description is cut off", async () => {
    restoreMetrics = stubTextMetrics({ clientHeight: 40, scrollHeight: 120 });
    const user = userEvent.setup();
    renderWithProviders(<TagDescription text={DESCRIPTION} />);

    await user.hover(screen.getByText(DESCRIPTION));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(DESCRIPTION);
  });

  it("shows no tooltip when the description fits", async () => {
    restoreMetrics = stubTextMetrics({ clientHeight: 40, scrollHeight: 40 });
    const user = userEvent.setup();
    renderWithProviders(<TagDescription text={DESCRIPTION} />);

    await user.hover(screen.getByText(DESCRIPTION));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("drops the native title tooltip", () => {
    renderWithProviders(<TagDescription text={DESCRIPTION} />);

    expect(screen.getByText(DESCRIPTION)).not.toHaveAttribute("title");
  });
});
