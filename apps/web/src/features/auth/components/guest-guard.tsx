"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

import { safeInternalPath } from "../lib/safe-redirect";
import { GuardFallback } from "./guard-fallback";
import { useSession } from "./session-provider";

export function GuestGuard({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const target = safeInternalPath(searchParams.get("from")) ?? "/";

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace(target);
  }, [status, router, target]);

  if (status === "unauthenticated") return children;

  return <GuardFallback />;
}
