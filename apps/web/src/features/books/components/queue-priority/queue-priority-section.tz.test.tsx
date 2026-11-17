import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const PINNED_TIME_ZONE = "Pacific/Kiritimati";
const TODAY = "2026-08-01T09:00:00";

let previousTimeZone: string | undefined;

beforeEach(() => {
  previousTimeZone = process.env.TZ;
  process.env.TZ = PINNED_TIME_ZONE;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(parseISO(TODAY));
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/api/profile/settings")
        ? Promise.resolve(
            new Response(JSON.stringify(defaultUserProfileSettings), {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }),
          )
        : Promise.reject(new Error(`unexpected fetch: ${String(input)}`)),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
    return;
  }
  process.env.TZ = previousTimeZone;
});

async function chooseReason(name: string) {
  await userEvent.click(reasonTrigger());
  await userEvent.click(await screen.findByRole("option", { name }));
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

function reasonTrigger() {
  return screen.getByRole("combobox", { name: new RegExp(copy.reason.label) });
}

function renderSection(
  initialValues: Partial<CreateBookFormValues> = {},
  onSubmit: (values: CreateBookFormValues) => void = vi.fn(),
) {
  renderWithProviders(<Harness initialValues={initialValues} onSubmit={onSubmit} />);
}

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
}

async function submittedValues(onSubmit: ReturnType<typeof vi.fn>) {
  await submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0]?.[0] as CreateBookFormValues;
}

describe(`QueuePrioritySection submit in ${PINNED_TIME_ZONE}`, () => {
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
