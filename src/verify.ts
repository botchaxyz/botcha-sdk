import { jwtVerify, errors } from "jose";
import { getJWKS } from "./jwks";

const API_BASE = "https://api.botcha.xyz";
const FRESHNESS_WINDOW_SEC = 600; // 10 minutes
const MAX_RECEIPT_LENGTH = 10_000;

// ── Types ──

export interface BotchaConfig {
  /** Platform secret key (sk_live_xxx) — used for API validation fallback */
  secretKey: string;
  /** Platform project ID — enables local aud check. If omitted, aud is checked via API fallback only. */
  projectId?: string;
}

export interface VerifyResult {
  valid: true;
  challengeId: string;
  projectId: string;
  issuedAt: number;
  expiresAt: number;
  fresh: boolean;
}

export interface VerifyError {
  valid: false;
  reason:
    | "INVALID_RECEIPT"
    | "RECEIPT_EXPIRED"
    | "MISSING_AUDIENCE"
    | "PROJECT_MISMATCH"
    | "MALFORMED_RECEIPT"
    | "UNAUTHORIZED"
    | "VALIDATION_SERVICE_UNAVAILABLE"
    | string;
}

export type VerifyOutcome = VerifyResult | VerifyError;

// ── Core verification ──

/**
 * Verify a BOTCHA receipt. Tries local JWKS first (fast, cached),
 * falls back to API validation if JWKS fails.
 */
export async function verifyReceipt(
  receipt: string,
  config: BotchaConfig
): Promise<VerifyOutcome> {
  // Input validation
  if (!receipt || typeof receipt !== "string" || receipt.length > MAX_RECEIPT_LENGTH) {
    return { valid: false, reason: "INVALID_RECEIPT" };
  }

  // Try local JWKS verification first (fast)
  try {
    const result = await verifyLocal(receipt, config.projectId);
    if (result) return result;
  } catch {
    // JWKS verification failed — fall through to API
  }

  // Fallback: API validation
  return verifyViaApi(receipt, config.secretKey);
}

// ── Local JWKS verification ──

async function verifyLocal(
  receipt: string,
  expectedProjectId?: string
): Promise<VerifyOutcome | null> {
  const jwks = getJWKS(API_BASE);

  try {
    const { payload } = await jwtVerify(receipt, jwks, {
      issuer: "botcha.xyz",
      algorithms: ["ES256"],
    });

    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp < now) {
      return { valid: false, reason: "RECEIPT_EXPIRED" };
    }

    // Only accept single-string audience
    if (typeof payload.aud !== "string" || !payload.aud) {
      return { valid: false, reason: "MISSING_AUDIENCE" };
    }
    const aud = payload.aud;

    // Validate challengeId claim exists
    if (typeof payload.challengeId !== "string") {
      return { valid: false, reason: "MALFORMED_RECEIPT" };
    }

    // If projectId is configured, verify the receipt belongs to this platform
    if (expectedProjectId && aud !== expectedProjectId) {
      return { valid: false, reason: "PROJECT_MISMATCH" };
    }

    // If no projectId configured, can't verify aud locally — fall back to API
    if (!expectedProjectId) {
      return null;
    }

    const age = now - (payload.iat || 0);

    return {
      valid: true,
      challengeId: payload.challengeId,
      projectId: aud,
      issuedAt: payload.iat || 0,
      expiresAt: payload.exp,
      fresh: age <= FRESHNESS_WINDOW_SEC,
    };
  } catch (err) {
    if (
      err instanceof errors.JWTExpired ||
      err instanceof errors.JWSSignatureVerificationFailed ||
      err instanceof errors.JWSInvalid
    ) {
      return { valid: false, reason: "INVALID_RECEIPT" };
    }
    // Unknown error — let it fall through to API validation
    return null;
  }
}

// ── API validation fallback ──

async function verifyViaApi(
  receipt: string,
  secretKey: string
): Promise<VerifyOutcome> {
  try {
    const res = await fetch(`${API_BASE}/v1/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ receipt }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: `HTTP_${res.status}`,
      })) as { error: string };
      return { valid: false, reason: err.error };
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data.valid) {
      return { valid: false, reason: (data.reason as string) || "INVALID_RECEIPT" };
    }

    // Validate required fields from API response
    if (
      typeof data.challengeId !== "string" ||
      typeof data.projectId !== "string" ||
      typeof data.issuedAt !== "number" ||
      typeof data.expiresAt !== "number"
    ) {
      return { valid: false, reason: "MALFORMED_RECEIPT" };
    }

    return {
      valid: true,
      challengeId: data.challengeId,
      projectId: data.projectId,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
      fresh: data.fresh === true,
    };
  } catch {
    return { valid: false, reason: "VALIDATION_SERVICE_UNAVAILABLE" };
  }
}
