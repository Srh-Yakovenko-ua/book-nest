import type { Mock } from "vitest";

import { describe, expect, it, vi } from "vitest";

import type { PrismaQueryEvent, PrismaService } from "../../core/database/prisma.service.js";

import { fakeOf } from "../../test/fake.js";
import { MetricsService } from "./metrics.service.js";
import { PrismaQueryMetrics } from "./prisma-query-metrics.js";

type QueryListener = (event: PrismaQueryEvent) => void;

const QUERY_EVENTS = {
  fast: {
    duration: 5,
    params: '["fast"]',
    query: 'SELECT "id" FROM "books" WHERE "id" = $1',
  },
  slow: {
    duration: 900,
    params: '["someone@example.com"]',
    query: 'SELECT "id" FROM "users" WHERE "email" = $1',
  },
};

function buildSubscribedMetrics(): {
  emit: QueryListener;
  metricsService: MetricsService;
  warn: Mock<(record: object, message: string) => void>;
} {
  const listeners: QueryListener[] = [];
  const prisma = fakeOf<PrismaService>({
    onQuery: (listener) => {
      listeners.push(listener);
    },
  });
  const metricsService = new MetricsService();
  const warn = vi.fn<(record: object, message: string) => void>();

  new PrismaQueryMetrics(prisma, metricsService, { warn }).onModuleInit();

  return {
    emit: (event) => {
      for (const listener of listeners) listener(event);
    },
    metricsService,
    warn,
  };
}

describe("PrismaQueryMetrics", () => {
  it("observes every query event in the duration histogram", async () => {
    const { emit, metricsService } = buildSubscribedMetrics();

    emit(QUERY_EVENTS.fast);
    emit(QUERY_EVENTS.slow);

    const rendered = await metricsService.render();

    expect(rendered).toContain("# TYPE db_query_duration_seconds histogram");
    expect(rendered).toContain("db_query_duration_seconds_count 2");
  });

  it("counts and warns about the slow query only, without its params", async () => {
    const { emit, metricsService, warn } = buildSubscribedMetrics();

    emit(QUERY_EVENTS.fast);
    emit(QUERY_EVENTS.slow);

    const rendered = await metricsService.render();

    expect(rendered).toContain("db_slow_queries_total 1");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      { durationMs: QUERY_EVENTS.slow.duration, query: QUERY_EVENTS.slow.query },
      "slow query",
    );
  });
});
