import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

const DURATION_BUCKETS_SECONDS = {
  dbQuery: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  http: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
};

@Injectable()
export class MetricsService {
  readonly dbQueryDurationSeconds: Histogram<string>;
  readonly dbSlowQueriesTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;
  readonly httpRequestsInFlight: Gauge<string>;
  readonly httpRequestsTotal: Counter<string>;
  readonly registry: Registry;

  get contentType(): string {
    return this.registry.contentType;
  }

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ prefix: "", register: this.registry });

    this.httpRequestsTotal = new Counter({
      help: "Total number of HTTP requests received",
      labelNames: ["method", "route", "status_code"],
      name: "http_requests_total",
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      buckets: DURATION_BUCKETS_SECONDS.http,
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      name: "http_request_duration_seconds",
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      help: "Number of HTTP requests currently being processed",
      labelNames: ["method", "route"],
      name: "http_requests_in_flight",
      registers: [this.registry],
    });

    this.dbQueryDurationSeconds = new Histogram({
      buckets: DURATION_BUCKETS_SECONDS.dbQuery,
      help: "Duration of Prisma queries in seconds",
      name: "db_query_duration_seconds",
      registers: [this.registry],
    });

    this.dbSlowQueriesTotal = new Counter({
      help: "Prisma queries slower than SLOW_QUERY_THRESHOLD_MS",
      name: "db_slow_queries_total",
      registers: [this.registry],
    });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
