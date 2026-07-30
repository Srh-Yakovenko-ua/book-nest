import type { Metadata } from "next";

import { type ReactNode, Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard, GuardFallback } from "@/features/auth";
import { RealtimeProvider } from "@/features/realtime";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<GuardFallback />}>
      <AuthGuard>
        <RealtimeProvider>
          <AppShell>{children}</AppShell>
        </RealtimeProvider>
      </AuthGuard>
    </Suspense>
  );
}
