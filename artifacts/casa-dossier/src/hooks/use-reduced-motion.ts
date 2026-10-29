import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user has asked the OS to minimise motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia?.(QUERY);
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
