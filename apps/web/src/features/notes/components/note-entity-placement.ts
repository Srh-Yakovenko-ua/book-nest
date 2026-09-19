export type NoteEntityPlacement = keyof typeof NOTE_ENTITY_PLACEMENT;

export const NOTE_ENTITY_PLACEMENT = {
  card: {
    cover: { className: "w-10", iconSize: 16, sizes: "40px" },
    metaLine: "line-clamp-1 wrap-anywhere",
    title: "line-clamp-2 font-heading text-sm leading-snug font-semibold text-ink wrap-anywhere",
  },
  fullView: {
    cover: { className: "w-16", iconSize: 22, sizes: "64px" },
    metaLine: "wrap-anywhere",
    title: "font-heading text-lg leading-snug text-ink wrap-anywhere",
  },
} as const;
