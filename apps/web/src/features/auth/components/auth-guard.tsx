"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

import { GuardFallback } from "./guard-fallback";
import { useSession } from "./session-provider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const from = query === "" ? pathname : `${pathname}?${query}`;

  useEffect(() => {
    if (status !== "unauthenticated") return;
    router.replace(`/login?from=${encodeURIComponent(from)}`);
  }, [status, router, from]);

  if (status === "authenticated") return children;

  return <GuardFallback />;
}
