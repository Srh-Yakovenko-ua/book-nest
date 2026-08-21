"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense, useEffect } from "react";

import { TOOLTIP_DELAY_MS } from "@/components/tooltip-hint";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MaintenanceGate } from "@/features/maintenance";
import { installGlobalErrorHandlers } from "@/lib/error-handlers";
import { getQueryClient } from "@/lib/query-client";
import { reportWebVitals } from "@/lib/vitals";

const isDev = process.env.NODE_ENV !== "production";

const ReactQueryDevtools = isDev
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  useEffect(() => {
    installGlobalErrorHandlers();
    reportWebVitals();

    if (isDev) {
      void import("react-scan").then(({ scan }) => {
        scan({ enabled: true, log: false });
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
        {children}
        <MaintenanceGate />
        <Toaster closeButton richColors />
        {ReactQueryDevtools && (
          <Suspense>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
