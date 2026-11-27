"use client";

import type { Nullable } from "@app/shared";

import { useRef, useState } from "react";

export function useCreateButtonFocus() {
  const createButtonElementRef = useRef<Nullable<HTMLButtonElement>>(null);
  const hasClosedDialogRef = useRef(false);
  const [attachCreateButton] = useState(() => (button: Nullable<HTMLButtonElement>) => {
    createButtonElementRef.current = button;
    if (button === null || !hasClosedDialogRef.current) return;
    if (document.activeElement === document.body) button.focus();
  });

  return {
    createButtonRef: attachCreateButton,
    focusCreateButtonOnClose: (event: Event) => {
      hasClosedDialogRef.current = true;
      const createButton = createButtonElementRef.current;
      if (createButton === null) return;
      event.preventDefault();
      createButton.focus();
    },
  };
}
