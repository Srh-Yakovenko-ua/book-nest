"use client";

import type { Nullable } from "@app/shared";

import { hasLocale } from "next-intl";
import { useEffect, useEffectEvent } from "react";

import { type Locale, routing } from "@/i18n/routing";

export type LinkDestination = {
  href: string;
  locale: Locale;
};

type LinkLeaveGuardOptions = {
  isGuarding: boolean;
  onLeaveAttempt: (destination: LinkDestination) => void;
};

export function useLinkLeaveGuard({ isGuarding, onLeaveAttempt }: LinkLeaveGuardOptions) {
  const reportLeaveAttempt = useEffectEvent(onLeaveAttempt);

  useEffect(() => {
    if (!isGuarding) return;

    function holdLinkLeave(event: MouseEvent) {
      const destination = leavingLinkDestination(event);
      if (destination === null) return;
      event.preventDefault();
      reportLeaveAttempt(destination);
    }

    window.addEventListener("click", holdLinkLeave, { capture: true });
    return () => window.removeEventListener("click", holdLinkLeave, { capture: true });
  }, [isGuarding]);
}

function leavingLinkDestination(event: MouseEvent): Nullable<LinkDestination> {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return null;
  if (anchor.target !== "" && anchor.target !== "_self") return null;

  const url = new URL(anchor.href);
  const current = window.location;
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null;

  const [, locale, ...segments] = url.pathname.split("/");
  if (!hasLocale(routing.locales, locale)) return null;

  return { href: `/${segments.join("/")}${url.search}${url.hash}`, locale };
}
