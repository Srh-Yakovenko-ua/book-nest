"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

import { safeInternalPath } from "../lib/safe-redirect";
import { GuardFallback } from "./guard-fallback";
import { useSession } from "./session-provider";

const GUEST_GUARD_EXEMPT_PATHS = ["/verify-email"];

export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isExempt = GUEST_GUARD_EXEMPT_PATHS.includes(pathname);
  const target = safeInternalPath(searchParams.get("from")) ?? "/";

  useEffect(() => {
    if (isExempt) return;
    if (status !== "authenticated") return;
    router.replace(target);
  }, [isExempt, status, router, target]);

  if (isExempt) return children;
  if (status === "unauthenticated") return children;

  return <GuardFallback />;
}
