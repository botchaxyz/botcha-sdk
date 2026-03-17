export type { BotchaConfig, VerifyResult, VerifyError, VerifyOutcome } from "./verify";
export type { MiddlewareOptions, Botcha403Body } from "./middleware";
export { botcha403, RECEIPT_HEADER } from "./middleware";

import { verifyReceipt, type BotchaConfig, type VerifyOutcome } from "./verify";
import { botcha403, validateSecretKey, validatePublicKey, RECEIPT_HEADER, type MiddlewareOptions } from "./middleware";

// ── Hono types ──

type HonoHandler = (
  c: {
    req: { header: (name: string) => string | undefined };
    json: (body: unknown, status?: number) => Response;
    set: (key: string, value: unknown) => void;
  },
  next: () => Promise<void>
) => Promise<Response | void>;

export interface Botcha {
  verify: (receipt: string) => Promise<VerifyOutcome>;
  middleware: (options: MiddlewareOptions) => HonoHandler;
}

// ── Factory ──

/**
 * Initialize the BOTCHA SDK with your platform credentials.
 *
 * Usage:
 *   import { createBotcha } from "@botcha/sdk/hono";
 *   const botcha = createBotcha({
 *     secretKey: "sk_live_xxx",
 *     projectId: "your-project-id"
 *   });
 *
 *   app.use("/api/action", botcha.middleware({ publicKey: "pk_live_xxx" }));
 */
export function createBotcha(config: BotchaConfig): Botcha {
  validateSecretKey(config.secretKey);

  return {
    verify: (receipt: string) => verifyReceipt(receipt, config),

    middleware: (options: MiddlewareOptions) => {
      validatePublicKey(options.publicKey);
      const headerName = options.header || RECEIPT_HEADER;

      return async (c, next) => {
        const receipt = c.req.header(headerName);

        if (!receipt) {
          return c.json(botcha403("MISSING_RECEIPT", options.publicKey, headerName), 403);
        }

        const result = await verifyReceipt(receipt, config);

        if (!result.valid) {
          return c.json(botcha403(result.reason, options.publicKey, headerName), 403);
        }

        c.set("botcha", result);
        await next();
      };
    },
  };
}
