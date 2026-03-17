export type { BotchaConfig, VerifyResult, VerifyError, VerifyOutcome } from "./verify";
export type { MiddlewareOptions, Botcha403Body } from "./middleware";
export { botcha403, RECEIPT_HEADER } from "./middleware";

import { verifyReceipt, type BotchaConfig, type VerifyResult, type VerifyOutcome } from "./verify";
import { botcha403, validateSecretKey, validatePublicKey, RECEIPT_HEADER, type MiddlewareOptions } from "./middleware";

// ── Express types ──

type ExpressHandler = (
  req: { headers: Record<string, string | string[] | undefined>; botcha?: VerifyResult },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: (err?: unknown) => void
) => Promise<void>;

export interface Botcha {
  verify: (receipt: string) => Promise<VerifyOutcome>;
  middleware: (options: MiddlewareOptions) => ExpressHandler;
}

// ── Factory ──

/**
 * Initialize the BOTCHA SDK with your platform credentials.
 *
 * Usage:
 *   const botcha = createBotcha({
 *     secretKey: "sk_live_xxx",
 *     projectId: "your-project-id"
 *   });
 *
 *   app.use("/api/action", botcha.middleware({ publicKey: "pk_live_xxx" }));
 *   const result = await botcha.verify(receipt);
 */
export function createBotcha(config: BotchaConfig): Botcha {
  validateSecretKey(config.secretKey);

  return {
    verify: (receipt: string) => verifyReceipt(receipt, config),

    middleware: (options: MiddlewareOptions) => {
      validatePublicKey(options.publicKey);
      const headerName = options.header || RECEIPT_HEADER;

      return async (req, res, next) => {
        try {
          const receipt = req.headers[headerName];

          if (!receipt || typeof receipt !== "string") {
            res.status(403).json(botcha403("MISSING_RECEIPT", options.publicKey, headerName));
            return;
          }

          const result = await verifyReceipt(receipt, config);

          if (!result.valid) {
            res.status(403).json(botcha403(result.reason, options.publicKey, headerName));
            return;
          }

          req.botcha = result;
          next();
        } catch (err) {
          next(err);
        }
      };
    },
  };
}
