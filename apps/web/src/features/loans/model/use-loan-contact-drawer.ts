"use client";

import type { Nullable } from "@app/shared";

import { useRef, useState } from "react";

import { restoreFocusTo } from "./loan-focus";

export type LoanContactDrawerController = {
  drawerProps: {
    contactId: Nullable<string>;
    onCloseAutoFocus: (event: Event) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
  openContact: (contactId: string) => void;
};

export function useLoanContactDrawer(): LoanContactDrawerController {
  const [contactId, setContactId] = useState<Nullable<string>>(null);
  const openerRef = useRef<Nullable<HTMLElement>>(null);

  return {
    drawerProps: {
      contactId,
      onCloseAutoFocus: (event) => restoreFocusTo(event, openerRef.current),
      onOpenChange: (open) => {
        if (!open) setContactId(null);
      },
      open: contactId !== null,
    },
    openContact: (nextContactId) => {
      const opener = document.activeElement;
      openerRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
      setContactId(nextContactId);
    },
  };
}
