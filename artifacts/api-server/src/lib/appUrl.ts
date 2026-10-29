/**
 * Public URL of the web app, for links in emails and Stripe redirects.
 * Uses the first deployed Replit domain, falling back to localhost in dev.
 */
export function getAppUrl(): string {
  const host = process.env.REPLIT_DOMAINS?.split(",")[0];
  const basePath = process.env.BASE_PATH ?? "";
  return host
    ? `https://${host}${basePath}`
    : `http://localhost:${process.env.PORT}${basePath}`;
}
