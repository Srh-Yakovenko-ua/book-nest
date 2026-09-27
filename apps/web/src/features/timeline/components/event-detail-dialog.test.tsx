import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import {
  makeTimelineEventDetailView,
  makeTimelineEventPreview,
  makeTimelineEventRelationEntry,
} from "../model/timeline.fixtures";
import { EventDetailDialog } from "./event-detail-dialog";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function linkedTo(targetId: string, title: string) {
  return {
    incoming: [],
    outgoing: [
      makeTimelineEventRelationEntry({
        event: makeTimelineEventPreview({ id: targetId, title }),
        id: `relation-${targetId}`,
        relationType: "related",
      }),
    ],
  };
}

function renderDialog(props: Partial<Parameters<typeof EventDetailDialog>[0]> = {}) {
  return renderWithProviders(
    <EventDetailDialog
      currentPage={null}
      eventId="event-1"
      guardEnabled={false}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onOpenChange={vi.fn()}
      onRevealEvent={vi.fn()}
      revealedEventIds={new Set()}
      {...props}
    />,
  );
}

function respondByEventId(details: Record<string, unknown>) {
  fetchMock.mockImplementation((input) => {
    const eventId = String(input).split("/api/timeline-events/")[1];
    const detail = eventId === undefined ? undefined : details[eventId];
    if (detail === undefined) {
      return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
    }
    return Promise.resolve(jsonResponse(detail));
  });
}

function respondWith(detail: unknown) {
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/api/timeline-events/")) {
      return Promise.resolve(jsonResponse(detail));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EventDetailDialog", () => {
  it("shows a loading placeholder while the event is fetched", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    renderDialog();

    expect(screen.getByRole("dialog", { name: "Завантаження хронології" })).toBeInTheDocument();
  });

  it("renders the event heading, summary and context block", async () => {
    respondWith(
      makeTimelineEventDetailView({
        chapter: "Розділ 5",
        location: "Визима",
        pageNumber: 200,
        storyTime: "Світанок",
        summary: "Геральт викриває справжнього вбивцю",
        title: "Викриття у Визимі",
      }),
    );

    renderDialog();

    expect(await screen.findByText("Викриття у Визимі")).toBeInTheDocument();
    expect(screen.getByText("Геральт викриває справжнього вбивцю")).toBeInTheDocument();
    expect(screen.getByText("Контекст")).toBeInTheDocument();
    expect(screen.getByText("Розділ 5")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("Світанок")).toBeInTheDocument();
    expect(screen.getByText("Визима")).toBeInTheDocument();
  });

  it("omits the context block when the event has no place details", async () => {
    respondWith(makeTimelineEventDetailView({ title: "Без контексту" }));

    renderDialog();

    expect(await screen.findByText("Без контексту")).toBeInTheDocument();
    expect(screen.queryByText("Контекст")).not.toBeInTheDocument();
  });

  it("marks a spoiler event in the header once it is revealed", async () => {
    respondWith(makeTimelineEventDetailView({ id: "event-1", isSpoiler: true }));

    renderDialog({ guardEnabled: true, revealedEventIds: new Set(["event-1"]) });

    expect(await screen.findByText("Спойлер")).toBeInTheDocument();
  });

  it("lists related events from both directions with their relation labels", async () => {
    respondWith(
      makeTimelineEventDetailView({
        relations: {
          incoming: [
            makeTimelineEventRelationEntry({
              direction: "incoming",
              event: makeTimelineEventPreview({ id: "cause", title: "Пророцтво відьми" }),
              id: "rel-in",
              relationType: "foreshadows",
            }),
          ],
          outgoing: [
            makeTimelineEventRelationEntry({
              direction: "outgoing",
              event: makeTimelineEventPreview({ id: "effect", title: "Наслідок битви" }),
              id: "rel-out",
              relationType: "foreshadows",
            }),
          ],
        },
      }),
    );

    renderDialog();

    expect(await screen.findByText("Пов’язані події")).toBeInTheDocument();
    expect(screen.getByText("Передвіщає")).toBeInTheDocument();
    expect(screen.getByText("Передвіщено подією")).toBeInTheDocument();
    expect(screen.getByText("Наслідок битви")).toBeInTheDocument();
    expect(screen.getByText("Пророцтво відьми")).toBeInTheDocument();
  });

  it("shows the resolving event for a resolved thread", async () => {
    respondWith(
      makeTimelineEventDetailView({
        resolvedBy: makeTimelineEventPreview({ id: "resolver", title: "Викриття зрадника" }),
        threadStatus: "resolved",
      }),
    );

    renderDialog();

    expect(await screen.findByText("Розв’язано подією")).toBeInTheDocument();
    expect(screen.getByText("Викриття зрадника")).toBeInTheDocument();
  });

  it("names the threads this event closes", async () => {
    respondWith(
      makeTimelineEventDetailView({
        resolves: [makeTimelineEventPreview({ id: "open-1", title: "Хто вбив старосту" })],
      }),
    );

    renderDialog();

    expect(await screen.findByText("Ця подія розв’язує")).toBeInTheDocument();
    expect(screen.getByText("Хто вбив старосту")).toBeInTheDocument();
  });

  it("recovers from a failed request through retry", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(makeTimelineEventDetailView({ title: "Відновлена подія" }))),
    );

    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Повторити" }));

    expect(await screen.findByText("Відновлена подія")).toBeInTheDocument();
  });
});

describe("EventDetailDialog guard", () => {
  it("hides a guarded event until the reader asks to see it", async () => {
    const onRevealEvent = vi.fn();
    respondWith(
      makeTimelineEventDetailView({
        id: "event-1",
        isSpoiler: true,
        summary: "Небезпечний спойлер",
        title: "Смерть наставника",
      }),
    );

    renderDialog({ guardEnabled: true, onRevealEvent });

    expect(await screen.findByText("Подія позначена як спойлер")).toBeInTheDocument();
    expect(screen.queryByText("Смерть наставника")).not.toBeInTheDocument();
    expect(screen.queryByText("Небезпечний спойлер")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати подію" }));

    expect(onRevealEvent).toHaveBeenCalledWith("event-1");
  });

  it("keeps guarding an event reached through a relation", async () => {
    respondByEventId({
      "event-1": makeTimelineEventDetailView({
        id: "event-1",
        relations: linkedTo("event-2", "Прихована подія"),
        title: "Відкрита подія",
      }),
      "event-2": makeTimelineEventDetailView({
        id: "event-2",
        isSpoiler: true,
        title: "Справжня назва",
      }),
    });

    renderDialog({ guardEnabled: true });

    await userEvent.click(await screen.findByRole("button", { name: /Прихована подія/ }));

    expect(await screen.findByText("Подія позначена як спойлер")).toBeInTheDocument();
    expect(screen.queryByText("Справжня назва")).not.toBeInTheDocument();
  });

  it("guards an event that lies beyond the reading position", async () => {
    respondWith(
      makeTimelineEventDetailView({ id: "event-1", pageNumber: 300, title: "Майбутня подія" }),
    );

    renderDialog({ currentPage: 100, guardEnabled: true });

    expect(
      await screen.findByText("Подія знаходиться далі вашої поточної позиції читання"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Майбутня подія")).not.toBeInTheDocument();
  });
});

describe("EventDetailDialog navigation stack", () => {
  function respondWithChain() {
    respondByEventId({
      "event-1": makeTimelineEventDetailView({
        id: "event-1",
        relations: linkedTo("event-2", "Подія Б"),
        title: "Подія А",
      }),
      "event-2": makeTimelineEventDetailView({
        id: "event-2",
        relations: linkedTo("event-3", "Подія В"),
        title: "Подія Б",
      }),
      "event-3": makeTimelineEventDetailView({ id: "event-3", title: "Подія В" }),
    });
  }

  it("walks forward through relations and back again", async () => {
    respondWithChain();

    renderDialog();

    expect(await screen.findByText("Подія А")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Назад" })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /Подія Б/ }));
    expect(await screen.findByRole("heading", { name: "Подія Б" })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /Подія В/ }));
    expect(await screen.findByRole("heading", { name: "Подія В" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(await screen.findByRole("heading", { name: "Подія Б" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(await screen.findByRole("heading", { name: "Подія А" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Назад" })).not.toBeInTheDocument();
  });

  it("edits the event currently on the stack, not the one the dialog opened with", async () => {
    const onEdit = vi.fn();
    respondWithChain();

    renderDialog({ onEdit });

    await userEvent.click(await screen.findByRole("button", { name: /Подія Б/ }));
    await screen.findByRole("heading", { name: "Подія Б" });
    await userEvent.click(screen.getByRole("button", { name: "Редагувати" }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "event-2" }));
  });

  it("deletes the event currently on the stack", async () => {
    const onDelete = vi.fn();
    respondWithChain();

    renderDialog({ onDelete });

    await userEvent.click(await screen.findByRole("button", { name: /Подія Б/ }));
    await screen.findByRole("heading", { name: "Подія Б" });
    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "event-2" }));
  });
});
