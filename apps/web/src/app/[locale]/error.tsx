"use client";

import { RouteError } from "@/components/route-error";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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

      <main className="relative flex min-h-screen flex-col px-8 pt-30 pb-10 md:px-16 md:pt-42 md:pb-14 lg:px-24 lg:pt-48 lg:pb-16">
        <RouteError reset={reset} />
      </main>
    </div>
  );
}
