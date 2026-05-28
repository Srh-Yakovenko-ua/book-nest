import { createLogger } from "@/lib/logger";

const log = createLogger("global-error");

export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    log.error("uncaught error", {
      colno: event.colno,
      error: event.error,
      filename: event.filename,
      lineno: event.lineno,
      message: event.message,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    log.error("unhandled promise rejection", {
      reason: event.reason,
    });
  });
}
