import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";

export function AppErrorBoundary() {
  const error = useRouteError();

  const isRouteError = isRouteErrorResponse(error);
  const isJsError = !isRouteError && error instanceof Error;

  const statusLabel = isRouteError
    ? `Error · ${error.status}`
    : isJsError
      ? "Error · Client"
      : "Error";

  const heading = isRouteError
    ? error.statusText
    : isJsError && error.name && error.name !== "Error"
      ? error.name
      : isJsError
        ? "Application error"
        : "Something went wrong";

  const message =
    isRouteError && error.data
      ? typeof error.data === "string"
        ? error.data
        : JSON.stringify(error.data)
      : isJsError
        ? error.message
        : "Something went wrong while rendering the page.";

  const stack = error instanceof Error ? error.stack : undefined;

  function handleReload() {
    window.location.reload();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 0%, oklch(0.62 0.22 25 / 0.18), transparent 60%),
            radial-gradient(ellipse 60% 60% at 100% 100%, oklch(0.28 0.1 280 / 0.2), transparent 65%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <main className="relative flex min-h-screen flex-col px-8 py-10 md:px-16 md:py-14 lg:px-24 lg:py-16 2xl:px-32 2xl:py-20">
        <header className="flex items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          <AlertCircle className="size-3.5 text-error" />
          <span>instagram / runtime error</span>
        </header>

        <section className="mt-20 flex-1 md:mt-28 lg:mt-32">
          <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            {statusLabel}
          </p>

          <h1 className="mt-6 font-display text-[clamp(2rem,4vw,3.5rem)] leading-[0.86] font-semibold tracking-[-0.035em]">
            {heading}
            <span className="text-error">.</span>
          </h1>

          <div className="mt-3 h-[2px] w-12 rounded-full bg-gradient-to-r from-error to-error/40" />

          <p className="mt-8 max-w-[720px] text-base leading-relaxed text-foreground md:text-lg">
            {message}
          </p>

          {__DEV__ && stack && (
            <details className="mt-8 max-w-[720px]">
              <summary className="cursor-pointer font-mono text-xs tracking-wide text-muted-foreground select-none">
                Stack trace
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-xs text-muted-foreground">
                {stack}
              </pre>
            </details>
          )}
        </section>

        <footer className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="h-12 cursor-pointer px-6 font-mono text-[11px] tracking-[0.22em] uppercase transition-all duration-150 hover:ring-4 hover:ring-primary/15"
              variant="outline"
            >
              <Link to="/">
                <ArrowLeft className="mr-2 size-4" />
                Back home
              </Link>
            </Button>

            <Button
              className="h-12 cursor-pointer px-6 font-mono text-[11px] tracking-[0.22em] uppercase transition-all duration-150 hover:shadow-[var(--shadow-glow-brand)]"
              onClick={handleReload}
              variant="default"
            >
              <RefreshCw className="mr-2 size-4" />
              Reload page
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
