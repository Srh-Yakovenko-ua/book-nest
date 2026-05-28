import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

import { createLogger } from "@/lib/logger";

const log = createLogger("vitals");

export function reportWebVitals(): void {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}

function report(metric: Metric): void {
  log.info(metric.name, {
    delta: Math.round(metric.delta),
    id: metric.id,
    rating: metric.rating,
    value: Math.round(metric.value),
  });

  if (__PROD__) {
    void metric;
  }
}
