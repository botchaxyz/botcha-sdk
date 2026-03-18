export type { BotchaConfig, VerifyResult, VerifyError, VerifyOutcome } from "./verify";
export type { MiddlewareOptions, Botcha403Body } from "./middleware";
export { botcha403, RECEIPT_HEADER } from "./middleware";

import { verifyReceipt, type BotchaConfig, type VerifyOutcome } from "./verify";
import { botcha403, validateSecretKey, validatePublicKey, RECEIPT_HEADER, type MiddlewareOptions } from "./middleware";
import type { VerifyResult } from "./verify";

// ── Web API types ──

export interface Botcha {
  verify: (receipt: string) => Promise<VerifyOutcome>;
  protect: (request: Request, options: MiddlewareOptions) => Promise<Response | VerifyResult>;
}

// ── Factory ──

/**
 * Initialize the BOTCHA SDK with your platform credentials.
 *
 * Usage (any Web API framework — Next.js, SvelteKit, Remix, Deno, etc.):
 *   const botcha = createBotcha({
 *     secretKey: "sk_live_xxx",
 *     projectId: "your-project-id"
 *   });
 *
 *   const result = await botcha.protect(request, { publicKey: "pk_live_xxx" });
 *   if (result instanceof Response) return result; // 403 or 500
 *   // result.challengeId, result.projectId, result.fresh
 */
export function createBotcha(config: BotchaConfig): Botcha {
  validateSecretKey(config.secretKey);

  return {
    verify: (receipt: string) => verifyReceipt(receipt, config),

    protect: async (request: Request, options: MiddlewareOptions) => {
      validatePublicKey(options.publicKey);
      const headerName = options.header || RECEIPT_HEADER;

      try {
        const receipt = request.headers.get(headerName);

        if (!receipt) {
          return Response.json(
            botcha403("MISSING_RECEIPT", options.publicKey, headerName),
            { status: 403 }
          );
        }

        const result = await verifyReceipt(receipt, config);

        if (!result.valid) {
          return Response.json(
            botcha403(result.reason, options.publicKey, headerName),
            { status: 403 }
          );
        }

        return result;
      } catch {
        return Response.json(
          { error: "BOTCHA_UNAVAILABLE", message: "Verification service error" },
          { status: 500 }
        );
      }
    },
  };
}
