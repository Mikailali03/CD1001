import { useAuth } from "@clerk/react";

export function useAuthFetch() {
  const { getToken } = useAuth();

  return async function authFetch(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...init, headers });
  };
}
