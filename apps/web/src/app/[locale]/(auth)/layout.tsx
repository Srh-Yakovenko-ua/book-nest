import { type ReactNode, Suspense } from "react";

import { GuardFallback, GuestGuard } from "@/features/auth";

export default function AuthAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<GuardFallback />}>
      <GuestGuard>{children}</GuestGuard>
    </Suspense>
  );
}
