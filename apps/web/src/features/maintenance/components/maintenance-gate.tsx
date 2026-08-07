"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { env } from "@/lib/env";

import { useMaintenanceStore } from "../model/maintenance-store";
import { MaintenanceScreen } from "./maintenance-screen";

const HEALTH_CHECK = {
  attemptsBeforeLongWait: 12,
  attemptsBeforeSlowest: 24,
  fastDelayMs: 10_000,
  path: "/api/health",
  slowerDelayMs: 30_000,
  slowestDelayMs: 60_000,
} as const;

export function MaintenanceGate() {
  const active = useMaintenanceStore((state) => state.active);

  if (!active) return null;

  return <MaintenanceWatcher />;
}

function delayAfter(attempt: number): number {
  if (attempt < HEALTH_CHECK.attemptsBeforeLongWait) return HEALTH_CHECK.fastDelayMs;
  if (attempt < HEALTH_CHECK.attemptsBeforeSlowest) return HEALTH_CHECK.slowerDelayMs;
  return HEALTH_CHECK.slowestDelayMs;
}

async function isBackUp(): Promise<boolean> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${HEALTH_CHECK.path}`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function MaintenanceWatcher() {
  const end = useMaintenanceStore((state) => state.end);
  const queryClient = useQueryClient();

  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const finish = useCallback(async () => {
    end();
    await queryClient.invalidateQueries({ type: "active" });
  }, [end, queryClient]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const poll = async (): Promise<void> => {
      if (await isBackUp()) {
        if (!cancelled) await finish();
        return;
      }
      if (cancelled) return;

      attempt += 1;
      setAttempts(attempt);
      timer = setTimeout(() => void poll(), delayAfter(attempt));
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [finish]);

  const onRetry = useCallback(() => {
    setChecking(true);
    void isBackUp()
      .then(async (up) => {
        if (up) await finish();
      })
      .finally(() => setChecking(false));
  }, [finish]);

  return (
    <MaintenanceScreen
      checking={checking}
      longWait={attempts >= HEALTH_CHECK.attemptsBeforeLongWait}
      onRetry={onRetry}
    />
  );
}
