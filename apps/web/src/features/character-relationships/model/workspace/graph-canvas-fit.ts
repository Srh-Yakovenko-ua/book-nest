export const CANVAS_FIT = {
  bottomGap: 16,
  max: 1024,
  min: { contained: 160, page: 288 },
} as const;

export function toCanvasFitHeight({
  contained,
  offsetTop,
  paddingBottom,
  viewportHeight,
}: {
  contained: boolean;
  offsetTop: number;
  paddingBottom: number;
  viewportHeight: number;
}): number {
  const gap = contained ? paddingBottom : CANVAS_FIT.bottomGap;
  const available = Math.floor(viewportHeight - offsetTop - gap);
  const min = contained ? CANVAS_FIT.min.contained : CANVAS_FIT.min.page;
  return Math.min(CANVAS_FIT.max, Math.max(min, available));
}
