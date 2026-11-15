"use client";

import { RouteError } from "@/components/route-error";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pt-12 pb-16 md:px-8 md:pt-20 lg:px-12">
      <RouteError reset={reset} />
    </main>
  );
}
