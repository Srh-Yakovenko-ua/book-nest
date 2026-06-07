"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
              Error · Fatal
            </p>
            <h1 className="font-display text-4xl font-semibold">
              Something went wrong<span className="text-error">.</span>
            </h1>
          </div>
          <Button className="cursor-pointer" onClick={reset} variant="default">
            <RefreshCw className="mr-2 size-4" />
            Reload page
          </Button>
        </main>
      </body>
    </html>
  );
}
