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

function renderDialog(props: Partial<Parameters<typeof EventDetailDialog>[0]> = {}) {
  return renderWithProviders(
    <EventDetailDialog
      eventId="event-1"
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onNavigate={vi.fn()}
      onOpenChange={vi.fn()}
      {...props}
    />,
  );
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

    expect(screen.getByText("Завантаження хронології")).toBeInTheDocument();
  });

  it("renders the event heading, summary and place details", async () => {
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
    expect(screen.getByText("Розділ 5")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("Світанок")).toBeInTheDocument();
    expect(screen.getByText("Визима")).toBeInTheDocument();
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

    expect(await screen.findByText("Передвіщає")).toBeInTheDocument();
    expect(screen.getByText("Передвіщено подією")).toBeInTheDocument();
    expect(screen.getByText("Наслідок битви")).toBeInTheDocument();
    expect(screen.getByText("Пророцтво відьми")).toBeInTheDocument();
  });

  it("navigates to a related event when its row is activated", async () => {
    const onNavigate = vi.fn();
    respondWith(
      makeTimelineEventDetailView({
        relations: {
          incoming: [],
          outgoing: [
            makeTimelineEventRelationEntry({
              event: makeTimelineEventPreview({ id: "effect", title: "Наслідок битви" }),
              id: "rel-out",
              relationType: "related",
            }),
          ],
        },
      }),
    );

    renderDialog({ onNavigate });

    await userEvent.click(await screen.findByRole("button", { name: /Наслідок битви/ }));

    expect(onNavigate).toHaveBeenCalledWith("effect");
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

  it("recovers from a failed request through retry", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(makeTimelineEventDetailView({ title: "Відновлена подія" }))),
    );

    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Повторити" }));

    expect(await screen.findByText("Відновлена подія")).toBeInTheDocument();
  });

  it("requests editing the open event", async () => {
    const onEdit = vi.fn();
    respondWith(makeTimelineEventDetailView({ id: "event-1" }));

    renderDialog({ onEdit });

    await userEvent.click(await screen.findByRole("button", { name: "Редагувати" }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1" }));
  });
});
