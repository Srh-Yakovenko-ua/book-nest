type AuthBridge = {
  getAccessToken: () => null | string;
  onRefreshFailed: () => void;
  refresh: () => Promise<string>;
};

let bridge: AuthBridge | null = null;

export function getAuthBridge(): AuthBridge | null {
  return bridge;
}

export function registerAuthBridge(next: AuthBridge): void {
  bridge = next;
}
