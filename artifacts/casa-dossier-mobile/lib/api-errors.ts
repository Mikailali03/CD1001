import { ApiError } from "@workspace/api-client-react";

export { ApiError };

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Server returns 403 { error: "upgrade_required" } for plan-gated endpoints. */
export function isUpgradeRequiredError(err: unknown): boolean {
  if (!isApiError(err) || err.status !== 403) return false;
  const data = err.data as { error?: unknown } | null;
  return data?.error === "upgrade_required";
}
