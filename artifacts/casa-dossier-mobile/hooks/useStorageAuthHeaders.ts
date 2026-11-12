import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";

// Stored photos, receipts and documents need the session on every request.
// Clerk tokens are short-lived, so keep a fresh one for image `source.headers`.
export function useStorageAuthHeaders(): Record<string, string> | undefined {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getToken()
        .then((t) => { if (alive) setToken(t); })
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [getToken]);

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
