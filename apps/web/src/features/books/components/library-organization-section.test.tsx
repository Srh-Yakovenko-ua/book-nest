import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { CreateBookFormValues } from "../model/create-book-form";

import { createBookFormDefaults, CreateBookFormSchema } from "../model/create-book-form";
import { LibraryOrganizationSection } from "./library-organization-section";

const organization = messages.books.organization;
const copy = organization.priority;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input).includes("/api/lists")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ items: [], page: 1, pagesCount: 0, pageSize: 50, totalCount: 0 }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function Harness({ initialValues = {} }: { initialValues?: Partial<CreateBookFormValues> }) {
  const form = useForm<CreateBookFormValues>({
    defaultValues: {
      ...createBookFormDefaults,
      authors: [{ name: "Анджей Сапковський" }],
      title: "Останнє бажання",
      ...initialValues,
    },
    resolver: zodResolver(CreateBookFormSchema),
  });

  return (
    <LibraryOrganizationSection
      control={form.control}
      errors={form.formState.errors}
      setValue={form.setValue}
    />
  );
}

function queueSwitch() {
  return screen.getByRole("switch", { name: new RegExp(organization.queue) });
}

function renderSection(initialValues: Partial<CreateBookFormValues> = {}) {
  renderWithProviders(<Harness initialValues={initialValues} />);
}

describe("LibraryOrganizationSection reading queue gating", () => {
  it("hides the priority block while the book stays out of the queue", () => {
    renderSection({ addToReadingQueue: false });

    expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: copy.title })).not.toBeInTheDocument();
  });

  it("reveals the priority block once the book joins the queue", async () => {
    renderSection({ addToReadingQueue: false });

    await userEvent.click(queueSwitch());

    expect(await screen.findByRole("radiogroup", { name: copy.title })).toBeInTheDocument();
  });

  it("starts the revealed block on the normal priority", async () => {
    renderSection({ addToReadingQueue: false });

    await userEvent.click(queueSwitch());

    expect(
      await screen.findByRole("radio", { name: new RegExp(copy.normal.label) }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("hides the priority block again when the book leaves the queue", async () => {
    renderSection({ addToReadingQueue: true, queuePriority: "high" });
    expect(screen.getByRole("radiogroup", { name: copy.title })).toBeInTheDocument();

    await userEvent.click(queueSwitch());

    expect(screen.queryByRole("radiogroup", { name: copy.title })).not.toBeInTheDocument();
  });

  it("keeps the queue toggle away from a book that is already being read", () => {
    renderSection({ readingStatus: "reading" });

    expect(
      screen.queryByRole("switch", { name: new RegExp(organization.queue) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: copy.title })).not.toBeInTheDocument();
  });
});
