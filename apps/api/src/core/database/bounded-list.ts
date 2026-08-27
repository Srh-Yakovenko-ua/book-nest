import { createLogger } from "../logger.js";

export const BOUNDED_LIST = { maxRows: 2000 } as const;

type TruncationLogger = {
  warn(record: object, message: string): void;
};

export function reportTruncation<TRow>({
  context,
  log = createLogger("bounded-list"),
  rows,
  scope,
}: {
  context: Readonly<Record<string, string>>;
  log?: TruncationLogger;
  rows: TRow[];
  scope: string;
}): TRow[] {
  if (rows.length === BOUNDED_LIST.maxRows) {
    log.warn({ ...context, cap: BOUNDED_LIST.maxRows }, `${scope} truncated at the cap`);
  }
  return rows;
}
