import { Injectable } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

const HTTP_DURATION_BUCKETS_SECONDS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];

@Injectable()
export class MetricsService {
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
      buckets: HTTP_DURATION_BUCKETS_SECONDS,
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
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
