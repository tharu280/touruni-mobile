// Shared 401-retry-with-refresh state, used by both client.ts and iotClient.ts
// so a token refresh triggered by either API client dedupes against one
// another instead of racing two independent refresh calls.

type AuthRefreshHandler = () => Promise<string | null>;

let authRefreshHandler: AuthRefreshHandler | null = null;
let authRefreshInFlight: Promise<string | null> | null = null;

export const setAuthRefreshHandler = (handler: AuthRefreshHandler | null) => {
  authRefreshHandler = handler;
};

export const refreshAccessTokenOnce = async (): Promise<string | null> => {
  if (!authRefreshHandler) return null;
  if (!authRefreshInFlight) {
    authRefreshInFlight = authRefreshHandler().finally(() => {
      authRefreshInFlight = null;
    });
  }
  return authRefreshInFlight;
};
