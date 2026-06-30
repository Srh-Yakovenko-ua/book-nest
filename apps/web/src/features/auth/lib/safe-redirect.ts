export function safeInternalPath(value: null | string | undefined): null | string {
  if (value === null || value === undefined) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\")) return null;
  return value;
}
