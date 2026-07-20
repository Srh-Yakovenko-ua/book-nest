import { refreshSession } from "../api/session";
import { useAuthStore } from "../model/auth-store";

let refreshInFlight: null | Promise<string> = null;

export function singleFlightRefresh(): Promise<string> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<string> {
  const run = async (): Promise<string> => {
    const result = await refreshSession();
    useAuthStore.getState().setSession(result.accessToken, result.user);
    return result.accessToken;
  };

  if (typeof navigator !== "undefined" && navigator.locks != null) {
    return navigator.locks.request("booknest-auth-refresh", run);
  }

  return run();
}
