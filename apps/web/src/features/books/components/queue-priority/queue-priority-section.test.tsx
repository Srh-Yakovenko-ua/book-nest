import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORIGINAL_TIME_ZONE = process.env.TZ;
process.env.TZ = "Pacific/Kiritimati";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { CreateBookFormValues } from "../../model/create-book-form";

import { createBookFormDefaults, CreateBookFormSchema } from "../../model/create-book-form";
import { QueuePrioritySection } from "./queue-priority-section";

const copy = messages.books.organization.priority;
const SUBMIT_LABEL = "Зберегти";
const TODAY = new Date(2026, 7, 1, 9, 0, 0);

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});

afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = ORIGINAL_TIME_ZONE;
});

function card(priority: keyof typeof cardNames) {
  return screen.getByRole("radio", { name: new RegExp(cardNames[priority]) });
}

function Harness({
  initialValues = {},
  onSubmit = vi.fn(),
}: {
  initialValues?: Partial<CreateBookFormValues>;
  onSubmit?: (values: CreateBookFormValues) => void;
}) {
  const form = useForm<CreateBookFormValues>({
    defaultValues: {
      ...createBookFormDefaults,
      addToReadingQueue: true,
      authors: [{ name: "Анджей Сапковський" }],
      title: "Останнє бажання",
      ...initialValues,
    },
    resolver: zodResolver(CreateBookFormSchema),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => onSubmit(values))}>
      <QueuePrioritySection
        control={form.control}
        errors={form.formState.errors}
        setValue={form.setValue}
      />
      <button type="submit">{SUBMIT_LABEL}</button>
    </form>
  );
}

function renderSection(
  initialValues: Partial<CreateBookFormValues> = {},
  onSubmit: (values: CreateBookFormValues) => void = vi.fn(),
) {
  renderWithProviders(<Harness initialValues={initialValues} onSubmit={onSubmit} />);
}

const cardNames = {
  high: copy.high.label,
  low: copy.low.label,
  normal: copy.normal.label,
};

async function chooseReason(name: string) {
  await userEvent.click(reasonTrigger());
  await userEvent.click(await screen.findByRole("option", { name }));
}

function reasonTrigger() {
  return screen.getByRole("combobox", { name: new RegExp(copy.reason.label) });
}

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
}

async function submittedValues(onSubmit: ReturnType<typeof vi.fn>) {
  await submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0]?.[0] as CreateBookFormValues;
}

describe("QueuePrioritySection display", () => {
  it("marks the normal priority as the active default", () => {
    renderSection();

    expect(card("normal")).toHaveAttribute("aria-checked", "true");
    expect(card("low")).toHaveAttribute("aria-checked", "false");
    expect(card("high")).toHaveAttribute("aria-checked", "false");
  });

  it("offers every priority of the reading queue", () => {
    renderSection();

    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it.each(["normal", "low"] as const)("shows no reason field for the %s priority", (priority) => {
    renderSection({ queuePriority: priority });

    expect(
      screen.queryByRole("combobox", { name: new RegExp(copy.reason.label) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(copy.customReason.label))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();
  });

  it("shows the reason field for the high priority", () => {
    renderSection({ queuePriority: "high" });

    expect(reasonTrigger()).toBeInTheDocument();
  });

  it("shows no target date until a reason is chosen", () => {
    renderSection({ queuePriority: "high" });

    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();
  });

  it("shows the target date for a reason that supports one", async () => {
    renderSection({ queuePriority: "high" });

    await chooseReason(copy.reason.options.bookClub);

    expect(screen.getByRole("button", { name: copy.targetDate.label })).toBeInTheDocument();
  });

  it("shows no target date for a reason that does not support one", async () => {
    renderSection({ queuePriority: "high" });

    await chooseReason(copy.reason.options.seriesOrder);

    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();
  });

  it("shows the custom text input for the other reason", async () => {
    renderSection({ queuePriority: "high" });

    await chooseReason(copy.reason.options.other);

    expect(screen.getByLabelText(new RegExp(copy.customReason.label))).toBeInTheDocument();
  });

  it("shows no target date for the other reason", async () => {
    renderSection({ queuePriority: "high" });

    await chooseReason(copy.reason.options.other);

    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();
  });

  it("explains that the priority does not move the book in the queue", () => {
    renderSection();

    expect(screen.getByText(/не змінює позицію книги автоматично/)).toBeInTheDocument();
  });

  it("links the position note to the reading queue page", () => {
    renderSection();

    expect(screen.getByRole("link", { name: copy.positionNoteLink })).toHaveAttribute(
      "href",
      "/reading-queue",
    );
  });
});

describe("QueuePrioritySection keyboard access", () => {
  it("gives the checked card the only stop in the tab order", () => {
    renderSection();

    expect(card("normal")).toHaveAttribute("tabindex", "0");
    expect(card("low")).toHaveAttribute("tabindex", "-1");
    expect(card("high")).toHaveAttribute("tabindex", "-1");
  });

  it("moves the selection to the next priority on an arrow key", async () => {
    renderSection();
    card("normal").focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(card("high")).toHaveAttribute("aria-checked", "true");
    expect(card("high")).toHaveFocus();
  });

  it("moves the selection to the previous priority on an arrow key", async () => {
    renderSection();
    card("normal").focus();

    await userEvent.keyboard("{ArrowLeft}");

    expect(card("low")).toHaveAttribute("aria-checked", "true");
    expect(card("low")).toHaveFocus();
  });

  it("wraps the selection around the end of the group", async () => {
    renderSection({ queuePriority: "high" });
    card("high").focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(card("low")).toHaveAttribute("aria-checked", "true");
  });

  it("selects a priority on click", async () => {
    renderSection();

    await userEvent.click(card("high"));

    expect(card("high")).toHaveAttribute("aria-checked", "true");
    expect(card("normal")).toHaveAttribute("aria-checked", "false");
  });
});

describe("QueuePrioritySection dependent fields", () => {
  it.each(["normal", "low"] as const)(
    "hides the priority details when leaving high for %s",
    async (priority) => {
      renderSection({ queuePriority: "high" });
      await chooseReason(copy.reason.options.other);
      expect(screen.getByLabelText(new RegExp(copy.customReason.label))).toBeInTheDocument();

      await userEvent.click(card(priority));

      expect(
        screen.queryByRole("combobox", { name: new RegExp(copy.reason.label) }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(new RegExp(copy.customReason.label))).not.toBeInTheDocument();
    },
  );

  it.each(["normal", "low"] as const)(
    "clears the reason, custom text and target date when leaving high for %s",
    async (priority) => {
      const onSubmit = vi.fn();
      renderSection(
        {
          queuePriority: "high",
          queuePriorityReason: "other",
          queuePriorityReasonCustomText: "Хочу прочитати перед відпусткою",
          queuePriorityTargetDate: "2026-08-24",
        },
        onSubmit,
      );

      await userEvent.click(card(priority));
      const values = await submittedValues(onSubmit);

      expect(values.queuePriority).toBe(priority);
      expect(values.queuePriorityReason).toBeNull();
      expect(values.queuePriorityReasonCustomText).toBeNull();
      expect(values.queuePriorityTargetDate).toBeNull();
    },
  );

  it("clears the custom text when the other reason is replaced", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);
    await chooseReason(copy.reason.options.other);
    await userEvent.type(
      screen.getByLabelText(new RegExp(copy.customReason.label)),
      "Хочу прочитати перед відпусткою",
    );

    await chooseReason(copy.reason.options.seriesOrder);
    const values = await submittedValues(onSubmit);

    expect(screen.queryByLabelText(new RegExp(copy.customReason.label))).not.toBeInTheDocument();
    expect(values.queuePriorityReason).toBe("series_order");
    expect(values.queuePriorityReasonCustomText).toBeNull();
  });

  it("clears the target date when a reason without a date is chosen", async () => {
    const onSubmit = vi.fn();
    renderSection(
      {
        queuePriority: "high",
        queuePriorityReason: "book_club",
        queuePriorityTargetDate: "2026-08-24",
      },
      onSubmit,
    );
    expect(screen.getByRole("button", { name: copy.targetDate.label })).toBeInTheDocument();

    await chooseReason(copy.reason.options.seriesOrder);
    const values = await submittedValues(onSubmit);

    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();
    expect(values.queuePriorityTargetDate).toBeNull();
  });

  it("clears the dependent fields when the reason itself is cleared", async () => {
    const onSubmit = vi.fn();
    renderSection(
      {
        queuePriority: "high",
        queuePriorityReason: "book_club",
        queuePriorityTargetDate: "2026-08-24",
      },
      onSubmit,
    );

    await userEvent.click(screen.getByRole("button", { name: copy.reason.clear }));

    expect(reasonTrigger()).toHaveTextContent(copy.reason.placeholder);
    expect(screen.queryByRole("button", { name: copy.targetDate.label })).not.toBeInTheDocument();

    const values = await submittedValues(onSubmit);
    expect(values.queuePriorityReason).toBeNull();
    expect(values.queuePriorityTargetDate).toBeNull();
  });
});

describe("QueuePrioritySection submit", () => {
  it("blocks submitting the other reason without custom text", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);
    await chooseReason(copy.reason.options.other);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.customReason.error);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submitting the other reason with blank custom text", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);
    await chooseReason(copy.reason.options.other);
    await userEvent.type(screen.getByLabelText(new RegExp(copy.customReason.label)), "   ");

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.customReason.error);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks the custom text input invalid once submitting failed", async () => {
    renderSection({ queuePriority: "high" });
    await chooseReason(copy.reason.options.other);

    await submit();

    await waitFor(() =>
      expect(screen.getByLabelText(new RegExp(copy.customReason.label))).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
  });

  it("submits the other reason once custom text is filled in", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);
    await chooseReason(copy.reason.options.other);
    await userEvent.type(
      screen.getByLabelText(new RegExp(copy.customReason.label)),
      "Хочу прочитати перед відпусткою",
    );

    const values = await submittedValues(onSubmit);

    expect(values.queuePriorityReason).toBe("other");
    expect(values.queuePriorityReasonCustomText).toBe("Хочу прочитати перед відпусткою");
  });

  it("submits a high priority that has no reason", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);

    const values = await submittedValues(onSubmit);

    expect(values.queuePriority).toBe("high");
    expect(values.queuePriorityReason).toBeNull();
  });

  it("keeps the picked day free of any time zone shift", async () => {
    const onSubmit = vi.fn();
    renderSection({ queuePriority: "high" }, onSubmit);
    await chooseReason(copy.reason.options.bookClub);

    await userEvent.click(screen.getByRole("button", { name: copy.targetDate.label }));
    await userEvent.click(await screen.findByRole("button", { name: /24-е серпня 2026/ }));
    const values = await submittedValues(onSubmit);

    expect(values.queuePriorityTargetDate).toBe("2026-08-24");
  });
});

describe("QueuePrioritySection edit mode", () => {
  it("shows the stored priority as the active card", () => {
    renderSection({ queuePriority: "high" });

    expect(card("high")).toHaveAttribute("aria-checked", "true");
  });

  it("shows the stored reason", () => {
    renderSection({ queuePriority: "high", queuePriorityReason: "book_club" });

    expect(reasonTrigger()).toHaveTextContent(copy.reason.options.bookClub);
  });

  it("shows the stored custom text of the other reason", () => {
    renderSection({
      queuePriority: "high",
      queuePriorityReason: "other",
      queuePriorityReasonCustomText: "Позичив у друга",
    });

    expect(screen.getByLabelText(new RegExp(copy.customReason.label))).toHaveValue(
      "Позичив у друга",
    );
  });

  it("shows the stored target date of a date reason", () => {
    renderSection({
      queuePriority: "high",
      queuePriorityReason: "book_club",
      queuePriorityTargetDate: "2026-08-24",
    });

    expect(screen.getByRole("button", { name: copy.targetDate.label })).toHaveTextContent(
      "24 серпня 2026",
    );
  });

  it("opens a legacy record without a priority on the normal default", () => {
    renderSection({
      queuePriority: undefined,
      queuePriorityReason: undefined,
      queuePriorityReasonCustomText: undefined,
      queuePriorityTargetDate: undefined,
    });

    expect(card("normal")).toHaveAttribute("aria-checked", "true");
  });
});
