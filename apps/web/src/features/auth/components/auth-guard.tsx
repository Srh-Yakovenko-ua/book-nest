"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

import { useGuardedSession } from "../hooks/use-guarded-session";
import { GuardFallback } from "./guard-fallback";

export function AuthGuard({ children }: { children: ReactNode }) {
  const session = useGuardedSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const from = query === "" ? pathname : `${pathname}?${query}`;

  useEffect(() => {
    if (session.kind !== "signed-out") return;
    router.replace(`/login?from=${encodeURIComponent(from)}`);
  }, [session.kind, router, from]);

  if (session.kind !== "signed-in") return <GuardFallback />;

  return <Fragment key={session.userId}>{children}</Fragment>;
}
