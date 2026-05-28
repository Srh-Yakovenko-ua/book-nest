export function gradientFromString(input: number | string): string {
  const source = typeof input === "number" ? String(input) : input;
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, oklch(0.75 0.15 ${hue}) 0%, oklch(0.55 0.22 ${(hue + 40) % 360}) 100%)`;
}
