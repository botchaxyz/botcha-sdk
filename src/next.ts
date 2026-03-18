// Re-export everything from the Web API adapter
export { createBotcha, botcha403, RECEIPT_HEADER } from "./web";
export type { Botcha, BotchaConfig, VerifyResult, VerifyError, VerifyOutcome, MiddlewareOptions, Botcha403Body } from "./web";

import type { VerifyResult } from "./verify";

// ── Next.js-specific: context forwarding ──

/** Header name used to forward BOTCHA context from Next.js middleware to route handlers. */
export const CONTEXT_HEADER = "x-botcha-context";

/**
 * Parse the BOTCHA context forwarded by middleware via the X-Botcha-Context header.
 *
 * Security note: This trusts the header value. Only use in routes protected
 * by BOTCHA middleware — otherwise an attacker could forge the header directly.
 *
 * Usage in a Next.js route handler:
 *   const botcha = getBotchaContext(request);
 *   if (!botcha) return Response.json({ error: "unauthorized" }, { status: 403 });
 */
export function getBotchaContext(request: Request): VerifyResult | null {
  const header = request.headers.get(CONTEXT_HEADER);
  if (!header) return null;

  try {
    const parsed = JSON.parse(header);
    if (parsed && parsed.valid === true && typeof parsed.challengeId === "string") {
      return parsed as VerifyResult;
    }
    return null;
  } catch {
    return null;
  }
}
