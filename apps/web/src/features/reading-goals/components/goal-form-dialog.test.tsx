import "@testing-library/jest-dom/vitest";

import type { ReadingGoalView } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode, RefObject } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeReadingGoalView } from "../model/reading-goals.fixtures";
import { GoalFormDialog } from "./goal-form-dialog";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);
const NEW_YORK_EVENING = {
  instant: "2026-11-16T02:00:00.000Z",
  timeZone: "America/New_York",
  todayLabel: "Сьогодні, неділя, 15-е листопада 2026 р.",
} as const;
const CREATE_GOAL_URL = "/api/lists/list-1/goal";
const PREVIEW_PATH = "/api/lists/list-1/goal/preview";
const GOAL_URL = "/api/goals/goal-1";
const FORM_COPY = messages.goals.form;
const THREE_COUNTED_BOOKS = "3 книги зарахуються одразу: їх уже дочитано сьогодні.";
const QUICK_PICK_GROUP = {
  deadline: "Швидкий вибір дедлайну",
  target: "Швидкий вибір кількості книг",
} as const;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type CreateDialogOptions = { onChangeList?: () => void; queryClient?: QueryClient };

const fetchMock = vi.fn();
const onOpenChange = vi.fn();
const openerRef: RefObject<HTMLButtonElement | null> = { current: null };

let profileTimeZone: string;
let respondToCreate: () => Promise<Response>;
let respondToPreview: () => Promise<Response>;
let respondToUpdate: () => Response;

function calendarDay(day: string) {
  return within(screen.getByRole("grid")).getByText(day);
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function expectOnlyTheGeneralRule(dialog: HTMLElement) {
  const status = within(dialog).getByRole("status");
  expect(status).toBeEmptyDOMElement();
  expect(status).not.toHaveTextContent(FORM_COPY.explanation);
  expect(within(dialog).getByText(FORM_COPY.explanation)).toBeVisible();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function openCreateDialog({ onChangeList, queryClient }: CreateDialogOptions = {}) {
  renderWithProviders(
    <GoalFormDialog
      bookCount={20}
      listName="Книги на осінь"
      mode={{ kind: "create", listId: "list-1", previousOutcome: null }}
      onChangeList={onChangeList}
      onOpenChange={onOpenChange}
      open
      openerRef={openerRef}
    />,
    { queryClient },
  );
  return screen.getByRole("dialog", { name: FORM_COPY.title });
}

function openEditDialog(goal: ReadingGoalView, bookCount = 20) {
  renderWithProviders(
    <GoalFormDialog
      bookCount={bookCount}
      listName="Книги на осінь"
      mode={{ goal, kind: "edit" }}
      onOpenChange={onOpenChange}
      open
      openerRef={openerRef}
    />,
  );
  return screen.getByRole("dialog");
}

function previewRequests(): URL[] {
  return requestedUrls().filter((url) => url.pathname === PREVIEW_PATH);
}

function quickPickLabels(dialog: HTMLElement, group: keyof typeof QUICK_PICK_GROUP) {
  return within(within(dialog).getByRole("group", { name: QUICK_PICK_GROUP[group] }))
    .getAllByRole("button")
    .map((button) => button.textContent);
}

function requestedUrls(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

function updateBody(): unknown {
  return JSON.parse(String(updateCall()?.[1].body));
}

function updateCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(GOAL_URL) && (init?.method ?? "GET").toUpperCase() === "PATCH",
  ) as [string, RequestInit] | undefined;
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  profileTimeZone = defaultUserProfileSettings.timezone;
  respondToCreate = () => Promise.resolve(jsonResponse(makeReadingGoalView()));
  respondToPreview = () => Promise.resolve(jsonResponse({ bookCount: 20, countedCount: 0 }));
  respondToUpdate = () => jsonResponse(makeReadingGoalView());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(
        jsonResponse({ ...defaultUserProfileSettings, timezone: profileTimeZone }),
      );
    if (url.includes(PREVIEW_PATH) && method === "GET") return respondToPreview();
    if (url.includes(CREATE_GOAL_URL) && method === "POST") return respondToCreate();
    if (url.includes(GOAL_URL) && method === "PATCH") return Promise.resolve(respondToUpdate());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoalFormDialog validation", () => {
  it("keeps today out of reach in the deadline calendar", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-08-20" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "До дати, 20 серпня 2026" }));
    const todayButton = await screen.findByRole("button", { name: /^Сьогодні/ });
    expect(todayButton).toBeDisabled();
    await userEvent.click(calendarDay("15"));

    expect(
      within(dialog).getByRole("button", { name: "До дати, 20 серпня 2026" }),
    ).toBeInTheDocument();
    expect(updateCall()).toBeUndefined();
  });

  it("caps the target at the books fixed in the goal", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 3 }), 5);
    const target = within(dialog).getByLabelText("Прочитати книг");

    expect(target).toHaveAttribute("max", "5");
    expect(target).toHaveAccessibleDescription("У цілі 5 книг");

    await userEvent.clear(target);
    await userEvent.type(target, "6");

    await waitFor(() => expect(target).toHaveAccessibleDescription("У цілі лише 5 книг"));
    expect(target).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).queryByText("У цілі 5 книг")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeDisabled();
    expect(updateCall()).toBeUndefined();
  });

  it("flags a target of zero books inline and keeps save locked", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 3 }), 5);
    const target = within(dialog).getByLabelText("Прочитати книг");

    await userEvent.clear(target);
    await userEvent.type(target, "0");

    await waitFor(() =>
      expect(target).toHaveAccessibleDescription(messages.goals.form.errors.targetMin),
    );
    expect(within(dialog).queryByText("У цілі 5 книг")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeDisabled();
  });

  it("shows a deadline the server rejected right next to its own field", async () => {
    respondToUpdate = () =>
      jsonResponse(
        { errorsMessages: [{ field: "deadline", message: "Deadline must be after today" }] },
        400,
      );
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-08-20" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "До дати, 20 серпня 2026" }));
    await userEvent.click(calendarDay("16"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "До дати, 16 серпня 2026" }),
      ).toHaveAccessibleDescription("Deadline must be after today"),
    );
    expect(updateBody()).toEqual({ deadline: "2026-08-16" });
  });
});

describe("GoalFormDialog changes", () => {
  it("keeps save locked until something changes", async () => {
    const dialog = openEditDialog(makeReadingGoalView());
    const save = within(dialog).getByRole("button", { name: "Зберегти" });

    expect(save).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");

    expect(save).toBeEnabled();
  });

  it("sends only the name when only the name changed", async () => {
    const dialog = openEditDialog(makeReadingGoalView());

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: "Осінній забіг" });
  });

  it("renames an expired goal without re-checking its old deadline", async () => {
    const dialog = openEditDialog(
      makeReadingGoalView({ daysLeft: -4, deadline: "2026-01-05", status: "expired" }),
    );

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Зимовий забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: "Зимовий забіг" });
    expect(
      within(dialog).getByRole("button", { name: "До дати, 5 січня 2026" }),
    ).not.toHaveAccessibleDescription("Оберіть дату пізніше за сьогодні");
  });

  it("clears a name the reader wiped out instead of saving an empty string", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ name: "Осінній забіг" }));

    await userEvent.clear(within(dialog).getByLabelText(/Назва цілі/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ name: null });
  });
});

describe("GoalFormDialog target presets", () => {
  it("offers only the presets the goal can hold and marks the current one", () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 8 }), 8);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "Усі · 8"]);
    expect(within(dialog).getByRole("button", { name: "Усі · 8" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not repeat a preset that already covers every book", () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 3 }), 10);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "10"]);
  });

  it("stops the last preset at the largest target the server accepts", () => {
    const dialog = openEditDialog(makeReadingGoalView(), 1500);

    expect(quickPickLabels(dialog, "target")).toEqual(["3", "5", "10", "Максимум · 1000"]);
  });

  it("fills the target from a preset and saves only that change", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 8 }), 20);

    await userEvent.click(within(dialog).getByRole("button", { name: "5" }));

    expect(within(dialog).getByLabelText("Прочитати книг")).toHaveValue(5);
    expect(within(dialog).getByRole("button", { name: "5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ targetCount: 5 });
  });
});

describe("GoalFormDialog deadline shortcuts", () => {
  it("sets the deadline to an ISO day counted from today", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-30" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual([
      "Кінець місяця",
      "Через 3 місяці",
      "Кінець року",
    ]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець місяця" }));
    expect(
      within(dialog).getByRole("button", { name: "До дати, 31 серпня 2026" }),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Через 3 місяці" }));
    expect(
      within(dialog).getByRole("button", { name: "До дати, 15 листопада 2026" }),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ deadline: "2026-11-15" });
  });

  it("hides the end of the month on its last day", async () => {
    vi.setSystemTime(new Date(2026, 7, 31, 9, 0, 0));
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-30" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual(["Через 3 місяці", "Кінець року"]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець року" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ deadline: "2026-12-31" });
  });

  it("offers a single shortcut when the month and the year end on the same day", () => {
    vi.setSystemTime(new Date(2026, 11, 10, 9, 0, 0));
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2027-01-20" }));

    expect(quickPickLabels(dialog, "deadline")).toEqual(["Кінець місяця", "Через 3 місяці"]);
  });
});

describe("GoalFormDialog while saving", () => {
  it("stays open on Escape while the goal is being created and closes once it is", async () => {
    const creating = deferredResponse();
    respondToCreate = () => creating.promise;
    renderWithProviders(
      <GoalFormDialog
        bookCount={20}
        listName="Книги на осінь"
        mode={{ kind: "create", listId: "list-1", previousOutcome: null }}
        onOpenChange={onOpenChange}
        open
        openerRef={openerRef}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Створити ціль для добірки" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець місяця" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Створити ціль" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeDisabled(),
    );

    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Створити ціль для добірки" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    creating.resolve(jsonResponse(makeReadingGoalView()));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ціль створено"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("GoalFormDialog with unsaved changes", () => {
  it("asks before Escape throws away a renamed goal and keeps the dialog", async () => {
    const dialog = openEditDialog(makeReadingGoalView());

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.keyboard("{Escape}");

    expect(
      await screen.findByRole("alertdialog", { name: messages.common.discardChanges.title }),
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("drops a changed target from the cancel button only after confirming, without saving", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ targetCount: 8 }));
    const target = within(dialog).getByLabelText("Прочитати книг");

    await userEvent.clear(target);
    await userEvent.type(target, "6");
    await userEvent.click(within(dialog).getByRole("button", { name: "Скасувати" }));
    const discard = await screen.findByRole("alertdialog", {
      name: messages.common.discardChanges.title,
    });

    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(
      within(discard).getByRole("button", { name: messages.common.discardChanges.confirm }),
    );

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(updateCall()).toBeUndefined();
  });

  it("returns focus to the cancel button when the reader keeps editing", async () => {
    const dialog = openEditDialog(makeReadingGoalView());
    const cancel = within(dialog).getByRole("button", { name: "Скасувати" });

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(cancel);
    const discard = await screen.findByRole("alertdialog", {
      name: messages.common.discardChanges.title,
    });
    await userEvent.click(
      within(discard).getByRole("button", { name: messages.common.discardChanges.cancel }),
    );

    await waitFor(() => expect(cancel).toHaveFocus());
    expect(within(dialog).getByLabelText(/Назва цілі/)).toHaveValue("Осінній забіг");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(updateCall()).toBeUndefined();
  });
});

describe("GoalFormDialog creation preview", () => {
  it("counts the books finished today and promises nothing while the target is higher", async () => {
    respondToPreview = () => Promise.resolve(jsonResponse({ bookCount: 20, countedCount: 3 }));
    const dialog = openCreateDialog();
    const status = within(dialog).getByRole("status");

    await waitFor(() => expect(status).toHaveTextContent(THREE_COUNTED_BOOKS));
    expect(status).not.toHaveTextContent(FORM_COPY.preview.completesNow);
  });

  it("follows the target with the completion verdict without asking the server again", async () => {
    respondToPreview = () => Promise.resolve(jsonResponse({ bookCount: 20, countedCount: 3 }));
    const dialog = openCreateDialog();
    const status = within(dialog).getByRole("status");
    const target = within(dialog).getByLabelText("Прочитати книг");
    await waitFor(() => expect(status).toHaveTextContent(THREE_COUNTED_BOOKS));

    await userEvent.clear(target);
    await userEvent.type(target, "3");

    expect(status).toHaveTextContent(`${THREE_COUNTED_BOOKS} ${FORM_COPY.preview.completesNow}`);

    await userEvent.clear(target);
    await userEvent.type(target, "4");

    expect(status).toHaveTextContent(THREE_COUNTED_BOOKS);
    expect(status).not.toHaveTextContent(FORM_COPY.preview.completesNow);
    expect(previewRequests()).toHaveLength(1);
  });

  it.each([
    { count: 1, sentence: "1 книга зарахується одразу: її вже дочитано сьогодні." },
    { count: 5, sentence: "5 книг зарахуються одразу: їх уже дочитано сьогодні." },
  ])("agrees the sentence with $count counted books", async ({ count, sentence }) => {
    respondToPreview = () => Promise.resolve(jsonResponse({ bookCount: 20, countedCount: count }));
    const dialog = openCreateDialog();

    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent(sentence));
  });

  it("adds nothing to the general rule when no book counts yet", async () => {
    const queryClient = createTestQueryClient();
    const dialog = openCreateDialog({ queryClient });

    await waitFor(() => expect(previewRequests()).toHaveLength(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expectOnlyTheGeneralRule(dialog);
  });

  it("keeps only the general rule while the preview is on its way", async () => {
    respondToPreview = () => deferredResponse().promise;
    const dialog = openCreateDialog();

    await waitFor(() => expect(previewRequests()).toHaveLength(1));

    expectOnlyTheGeneralRule(dialog);
  });

  it("keeps only the general rule when the preview fails", async () => {
    respondToPreview = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    const queryClient = createTestQueryClient();
    const dialog = openCreateDialog({ queryClient });

    await waitFor(() => expect(previewRequests()).toHaveLength(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expectOnlyTheGeneralRule(dialog);
  });

  it("asks without a deadline until one is chosen, then for that day", async () => {
    const dialog = openCreateDialog();
    await waitFor(() => expect(previewRequests()).toHaveLength(1));

    await userEvent.click(within(dialog).getByRole("button", { name: "Кінець місяця" }));

    await waitFor(() =>
      expect(previewRequests().map((url) => url.searchParams.get("deadline"))).toEqual([
        null,
        "2026-08-31",
      ]),
    );
  });

  it("asks nothing about the preview while a goal is edited", async () => {
    openEditDialog(makeReadingGoalView());

    await waitFor(() =>
      expect(requestedUrls().map((url) => url.pathname)).toContain("/api/profile/settings"),
    );
    expect(previewRequests()).toEqual([]);
  });

  it("shows no preview region while a goal is edited", () => {
    const dialog = openEditDialog(makeReadingGoalView());

    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("GoalFormDialog list change", () => {
  it("offers no list change when the dialog has nowhere to return to", () => {
    const dialog = openCreateDialog();

    expect(
      within(dialog).queryByRole("button", { name: FORM_COPY.changeList }),
    ).not.toBeInTheDocument();
  });

  it("goes back to the list choice at once from an untouched form", async () => {
    const onChangeList = vi.fn();
    const dialog = openCreateDialog({ onChangeList });

    await userEvent.click(within(dialog).getByRole("button", { name: FORM_COPY.changeList }));

    expect(onChangeList).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks before a typed name is thrown away on the way back to the lists", async () => {
    const onChangeList = vi.fn();
    const dialog = openCreateDialog({ onChangeList });

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: FORM_COPY.changeList }));

    expect(
      await screen.findByRole("alertdialog", { name: messages.common.discardChanges.title }),
    ).toBeInTheDocument();
    expect(onChangeList).not.toHaveBeenCalled();
  });

  it("goes back to the lists once the reader confirms the discard", async () => {
    const onChangeList = vi.fn();
    const dialog = openCreateDialog({ onChangeList });

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(within(dialog).getByRole("button", { name: FORM_COPY.changeList }));
    const discard = await screen.findByRole("alertdialog", {
      name: messages.common.discardChanges.title,
    });
    await userEvent.click(
      within(discard).getByRole("button", { name: messages.common.discardChanges.confirm }),
    );

    await waitFor(() => expect(onChangeList).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the draft and focuses the list change again when the reader keeps editing", async () => {
    const onChangeList = vi.fn();
    const dialog = openCreateDialog({ onChangeList });
    const changeList = within(dialog).getByRole("button", { name: FORM_COPY.changeList });

    await userEvent.type(within(dialog).getByLabelText(/Назва цілі/), "Осінній забіг");
    await userEvent.click(changeList);
    const discard = await screen.findByRole("alertdialog", {
      name: messages.common.discardChanges.title,
    });
    await userEvent.click(
      within(discard).getByRole("button", { name: messages.common.discardChanges.cancel }),
    );

    await waitFor(() => expect(changeList).toHaveFocus());
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Назва цілі/)).toHaveValue("Осінній забіг");
    expect(onChangeList).not.toHaveBeenCalled();
  });
});

describe("GoalFormDialog in the profile time zone", () => {
  beforeEach(() => {
    vi.setSystemTime(NEW_YORK_EVENING.instant);
    profileTimeZone = NEW_YORK_EVENING.timeZone;
  });

  it("accepts the next New York day as a deadline while UTC has already reached it", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-20" }));

    await userEvent.click(
      within(dialog).getByRole("button", { name: "До дати, 20 листопада 2026" }),
    );
    await userEvent.click(calendarDay("16"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ deadline: "2026-11-16" });
  });

  it("keeps the current New York day out of reach in the deadline calendar", async () => {
    const dialog = openEditDialog(makeReadingGoalView({ deadline: "2026-11-20" }));

    await userEvent.click(
      within(dialog).getByRole("button", { name: "До дати, 20 листопада 2026" }),
    );
    const todayButton = await screen.findByRole("button", { name: NEW_YORK_EVENING.todayLabel });
    expect(todayButton).toBeDisabled();
    await userEvent.click(calendarDay("15"));

    expect(
      within(dialog).getByRole("button", { name: "До дати, 20 листопада 2026" }),
    ).toBeInTheDocument();
    expect(updateCall()).toBeUndefined();
  });
});
