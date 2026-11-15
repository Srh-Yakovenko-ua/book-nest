export function buildDocumentTitle({ appName, page }: { appName: string; page: string }): string {
  return `${page} · ${appName}`;
}
