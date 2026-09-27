export type NoteCardLayout = keyof typeof NOTE_CARD_LAYOUT;

type NoteCardLayoutSpec = {
  fitsPreviewToCard: boolean;
  gate: string;
  preview: string;
  shell: string;
};

const NOTE_CARD_SHELL =
  "flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none";

export const NOTE_CARD_LAYOUT = {
  compact: {
    fitsPreviewToCard: false,
    gate: "gap-1 px-3 py-4 md:h-auto",
    preview: "line-clamp-3",
    shell: "flex w-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-background p-3",
  },
  embedded: {
    fitsPreviewToCard: false,
    gate: "md:h-auto",
    preview: "line-clamp-5",
    shell: NOTE_CARD_SHELL,
  },
  grid: {
    fitsPreviewToCard: true,
    gate: "",
    preview: "line-clamp-5",
    shell: `${NOTE_CARD_SHELL} md:h-96 md:overflow-hidden`,
  },
  list: {
    fitsPreviewToCard: false,
    gate: "md:h-auto",
    preview: "line-clamp-3",
    shell: NOTE_CARD_SHELL,
  },
} as const satisfies Record<string, NoteCardLayoutSpec>;
