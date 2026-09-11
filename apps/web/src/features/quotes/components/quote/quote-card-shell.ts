export const QUOTE_CARD_SHELL = {
  base: "flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card",
  fixedHeight: "md:h-[27.5rem] md:overflow-hidden",
  interactive:
    "transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none",
} as const;
