import type { Nullable } from "@app/shared";

export type HomeActiveBookAction = "finished" | "paused" | "progress";

export type HomeActiveBookDialog =
  | { bookId: string; kind: "progress" }
  | { bookId: string; kind: "status"; status: "finished" | "paused" }
  | { kind: "closed" };

export function homeActiveBookDialogTarget(dialog: HomeActiveBookDialog): Nullable<string> {
  return dialog.kind === "closed" ? null : dialog.bookId;
}

export function openHomeActiveBookDialog({
  action,
  bookId,
}: {
  action: HomeActiveBookAction;
  bookId: string;
}): HomeActiveBookDialog {
  if (action === "progress") return { bookId, kind: "progress" };
  return { bookId, kind: "status", status: action };
}
