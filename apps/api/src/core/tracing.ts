import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK, tracing } from "@opentelemetry/sdk-node";

import { env } from "../config/env.js";

const DEFAULT_SERVICE_NAME = "monorepo-api";

let activeSdk: NodeSDK | undefined;

export async function shutdownTracing(): Promise<void> {
  if (!activeSdk) return;
  try {
    await activeSdk.shutdown();
  } finally {
    activeSdk = undefined;
  }
}

export function startTracing(): void {
  if (!env.tracingEnabled) return;
  if (activeSdk) return;

  const sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName: process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
    spanProcessor: new tracing.SimpleSpanProcessor(new tracing.ConsoleSpanExporter()),
  });

  sdk.start();
  activeSdk = sdk;
}

startTracing();
