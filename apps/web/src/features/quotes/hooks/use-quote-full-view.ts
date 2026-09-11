"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useRef, useState } from "react";

type QuoteFullView = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openFrom: (trigger: HTMLButtonElement) => void;
  triggerRef: RefObject<Nullable<HTMLButtonElement>>;
};

export function useQuoteFullView(): QuoteFullView {
  const triggerRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openFrom = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setIsOpen(true);
  };

  return { isOpen, onOpenChange: setIsOpen, openFrom, triggerRef };
}
