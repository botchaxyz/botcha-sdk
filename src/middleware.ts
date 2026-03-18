// ── Constants ──

export const RECEIPT_HEADER = "x-botcha-receipt";

const SKILL_URL = "https://api.botcha.xyz/skill.md";

// ── Types ──

export interface MiddlewareOptions {
  /** Platform public key (pk_live_xxx) — included in 403 responses so agents know how to verify */
  publicKey: string;
  /** Custom header name for the receipt (default: x-botcha-receipt) */
  header?: string;
}

export interface Botcha403Body {
  error: "BOTCHA_REQUIRED";
  message: string;
  reason: string;
  public_key: string;
  receipt_header: string;
  skill_url: string;
}

// ── 403 builder ──

/**
 * Build the structured 403 response body for BOTCHA verification failures.
 * Includes everything an agent needs to self-onboard.
 */
export function botcha403(
  reason: string,
  publicKey: string,
  header: string
): Botcha403Body {
  return {
    error: "BOTCHA_REQUIRED",
    message: `This endpoint requires BOTCHA verification. Install: command -v botcha >/dev/null 2>&1 || npm install -g @botcha/cli@latest — then run: botcha challenge --key ${publicKey} and botcha solve --id <challengeId> --response '...'. Retry with header ${header}: <receipt>. Full instructions: ${SKILL_URL}`,
    reason,
    public_key: publicKey,
    receipt_header: header,
    skill_url: SKILL_URL,
  };
}

// ── Validation ──

export function validateSecretKey(secretKey: string): void {
  if (!secretKey || !secretKey.startsWith("sk_")) {
    throw new Error("BOTCHA: secretKey must be a secret key (sk_live_xxx or sk_test_xxx).");
  }
}

export function validatePublicKey(publicKey: string): void {
  if (publicKey.startsWith("sk_")) {
    throw new Error(
      "BOTCHA: publicKey must be a public key (pk_live_xxx or pk_test_xxx), not a secret key. " +
      "Passing a secret key would leak it in 403 responses."
    );
  }
}
