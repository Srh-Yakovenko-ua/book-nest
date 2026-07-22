import "@testing-library/jest-dom/vitest";

import type { ReadingQueueItemView, ReadingQueueVolumeSummaryView } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { makeQueueVolumeSummary } from "../model/queue-volume.fixtures";
import { makeBookView } from "./book-details.fixtures";
import { QueueVolumeBlock } from "./queue-volume-block";

const copy = messages.readingQueue.volume;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockVolume(view: ReadingQueueVolumeSummaryView) {
  mockVolumeFetch(() => Promise.resolve(jsonResponse(view)));
}

function mockVolumeFetch(respond: () => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/reading-queue/volume-summary")) return respond();
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function queueItem(position: number, overrides: Parameters<typeof makeBookView>[0]) {
  return {
    book: makeBookView({ isInReadingQueue: true, ...overrides }),
    position,
  } satisfies ReadingQueueItemView;
}

function withForecast(
  overrides: Partial<ReadingQueueVolumeSummaryView["estimate"]>,
  rest: Partial<ReadingQueueVolumeSummaryView> = {},
): ReadingQueueVolumeSummaryView {
  return makeQueueVolumeSummary({
    coverage: { calculatedBooks: 4, ratio: 1, totalBooks: 4 },
    estimate: {
      daysMax: null,
      daysMin: null,
      daysUntilForecast: null,
      reasonUnavailable: null,
      ...overrides,
    },
    pages: { invalidBooks: 0, knownRemaining: 1200, missingBooks: 0 },
    queueBooksCount: 4,
    ...rest,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QueueVolumeBlock", () => {
  it("shows the remaining volume and a time range when the forecast is available", async () => {
    mockVolume(withForecast({ daysMax: 20, daysMin: 15 }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.remainingCaption)).toBeInTheDocument();
    expect(screen.getByText(copy.forecast.label)).toBeInTheDocument();
    expect(screen.getByText(/2–3\s*тижні/)).toBeInTheDocument();
    expect(screen.getByText("Враховано 4 із 4 книг")).toBeInTheDocument();
  });

  it("renders nothing when the queue is empty", async () => {
    mockVolume(makeQueueVolumeSummary());

    const { container } = renderWithProviders(<QueueVolumeBlock items={[]} />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("explains that there is no data to calculate from", async () => {
    mockVolume(
      withForecast(
        { reasonUnavailable: "no_volume_data" },
        {
          coverage: { calculatedBooks: 0, ratio: 0, totalBooks: 0 },
          hasMissingData: true,
          pages: { invalidBooks: 0, knownRemaining: 0, missingBooks: 0 },
        },
      ),
    );

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.forecast.noVolumeData)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.cta })).toBeInTheDocument();
  });

  it("marks the volume as a lower bound and hides the forecast when coverage is too low", async () => {
    mockVolume(
      withForecast(
        { reasonUnavailable: "insufficient_coverage" },
        {
          coverage: { calculatedBooks: 2, ratio: 0.5, totalBooks: 4 },
          hasMissingData: true,
          pages: { invalidBooks: 0, knownRemaining: 600, missingBooks: 2 },
        },
      ),
    );

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.remainingPartialCaption)).toBeInTheDocument();
    expect(screen.queryByText(copy.forecast.label)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.cta })).toBeInTheDocument();
  });

  it("counts down the days left until a forecast appears", async () => {
    mockVolume(withForecast({ daysUntilForecast: 19, reasonUnavailable: "insufficient_history" }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(/через 19 днів/)).toBeInTheDocument();
    expect(screen.queryByText(copy.forecast.updateProgress)).not.toBeInTheDocument();
  });

  it("asks for progress updates when waiting alone will not produce a forecast", async () => {
    mockVolume(withForecast({ reasonUnavailable: "insufficient_history" }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.forecast.updateProgress)).toBeInTheDocument();
    expect(screen.queryByText(/через/)).not.toBeInTheDocument();
  });

  it("reports stale reading activity", async () => {
    mockVolume(withForecast({ reasonUnavailable: "stale_activity" }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.forecast.staleActivity)).toBeInTheDocument();
  });

  it("reports a zero pace with the same wording as stale activity", async () => {
    mockVolume(withForecast({ reasonUnavailable: "zero_pace" }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.forecast.staleActivity)).toBeInTheDocument();
  });

  it("hides the call to action when nothing is missing", async () => {
    mockVolume(withForecast({ daysMax: 20, daysMin: 15 }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.cta })).not.toBeInTheDocument();
  });

  it("omits insight rows whose counters are zero", async () => {
    mockVolume(withForecast({ daysMax: 20, daysMin: 15 }));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists the missing, invalid and audiobook-only insights when they are non-zero", async () => {
    mockVolume(
      withForecast(
        { daysMax: 20, daysMin: 15 },
        {
          audiobookOnlyCount: 2,
          coverage: { calculatedBooks: 4, ratio: 0.8, totalBooks: 5 },
          hasMissingData: true,
          pages: { invalidBooks: 3, knownRemaining: 1200, missingBooks: 1 },
        },
      ),
    );

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(/1 книга без кількості сторінок/)).toBeInTheDocument();
    expect(screen.getByText(/3 книги мають неузгоджений прогрес/)).toBeInTheDocument();
    expect(screen.getByText(/2 аудіокниги/)).toBeInTheDocument();
  });

  it("counts finished books still in the queue from the loaded items, not from the summary", async () => {
    mockVolume(withForecast({ daysMax: 20, daysMin: 15 }));

    renderWithProviders(
      <QueueVolumeBlock
        items={[
          queueItem(1, { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", readingStatus: "finished" }),
          queueItem(2, { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", readingStatus: "dnf" }),
          queueItem(3, { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", readingStatus: "reading" }),
        ]}
      />,
    );

    expect(await screen.findByText(/2 дочитані книги ще залишаються в черзі/)).toBeInTheDocument();
  });

  it("offers a retry when the summary fails to load", async () => {
    mockVolumeFetch(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderWithProviders(<QueueVolumeBlock items={[]} />);

    expect(await screen.findByText(copy.error.load)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.error.retry })).toBeInTheDocument();
  });
});
