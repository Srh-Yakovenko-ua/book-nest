import { MEDIA_DERIVATIVES, type MediaDerivative } from "@app/shared";

export function buildDerivativeRecord<TValue>(
  valueFor: (derivative: MediaDerivative) => TValue,
): Record<MediaDerivative, TValue> {
  const record = {} as Record<MediaDerivative, TValue>;
  for (const derivative of MEDIA_DERIVATIVES) {
    record[derivative] = valueFor(derivative);
  }
  return record;
}
