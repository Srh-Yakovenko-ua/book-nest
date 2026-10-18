"use client";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RelationshipFormRootError({ message }: { message: string | undefined }) {
  if (message === undefined || message === "") return null;

  return (
    <Alert variant="destructive">
      <UiIcon name="alert-triangle" size={16} />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
