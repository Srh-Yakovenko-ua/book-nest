import "@/lib/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installGlobalErrorHandlers } from "@/lib/error-handlers";
import { queryClient } from "@/lib/query-client";
import { reportWebVitals } from "@/lib/vitals";

import { App } from "./App";
import "./index.css";

if (__DEV__) {
  void import("react-scan").then(({ scan }) => {
    scan({ enabled: true, log: false });
  });
  void import("@axe-core/react").then((axe) => {
    void axe.default(React, ReactDOM, 1000);
  });
}

const ReactQueryDevtools = __DEV__
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Toaster closeButton richColors />
        {ReactQueryDevtools && (
          <Suspense>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

reportWebVitals();
