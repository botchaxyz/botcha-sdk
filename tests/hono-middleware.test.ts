import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock verify module
vi.mock("../src/verify", () => ({
  verifyReceipt: vi.fn(),
}));

import { createBotcha } from "../src/hono";
import { verifyReceipt } from "../src/verify";

const config = { secretKey: "sk_live_test", projectId: "proj-1" };
const pk = "pk_live_test";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Hono middleware", () => {
  function makeCtx(headerValue?: string) {
    return {
      req: { header: (name: string) => (name === "x-botcha-receipt" ? headerValue : undefined) },
      json: vi.fn((body: unknown, status?: number) => ({ body, status }) as unknown as Response),
      set: vi.fn(),
    };
  }

  function makeCustomCtx(headerName: string, headerValue?: string) {
    return {
      req: { header: (name: string) => (name === headerName ? headerValue : undefined) },
      json: vi.fn((body: unknown, status?: number) => ({ body, status }) as unknown as Response),
      set: vi.fn(),
    };
  }

  it("returns 403 with full botcha403 shape when receipt header is missing", async () => {
    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk });
    const c = makeCtx();
    const next = vi.fn();

    await mw(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "BOTCHA_REQUIRED",
        reason: "MISSING_RECEIPT",
        public_key: pk,
        receipt_header: "x-botcha-receipt",
        skill_url: "https://api.botcha.xyz/skill.md",
      }),
      403
    );
    const body = c.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toContain("skill.md");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 with full botcha403 shape when receipt is invalid", async () => {
    vi.mocked(verifyReceipt).mockResolvedValue({ valid: false, reason: "INVALID_RECEIPT" });

    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk });
    const c = makeCtx("bad.jwt");
    const next = vi.fn();

    await mw(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "BOTCHA_REQUIRED",
        reason: "INVALID_RECEIPT",
        public_key: pk,
        skill_url: "https://api.botcha.xyz/skill.md",
      }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets botcha on context when receipt is valid", async () => {
    const verifyResult = {
      valid: true as const,
      challengeId: "ch-1",
      projectId: "proj-1",
      issuedAt: 1000,
      expiresAt: 2000,
      fresh: true,
    };
    vi.mocked(verifyReceipt).mockResolvedValue(verifyResult);

    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk });
    const c = makeCtx("good.jwt");
    const next = vi.fn();

    await mw(c, next);

    expect(next).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith("botcha", verifyResult);
  });

  it("uses custom header when configured", async () => {
    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk, header: "x-custom" });
    const c = makeCustomCtx("x-custom");
    const next = vi.fn();

    await mw(c, next);

    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ receipt_header: "x-custom" }),
      403
    );
  });
});

describe("createBotcha validation", () => {
  it("throws if secretKey doesn't start with sk_", () => {
    expect(() => createBotcha({ secretKey: "bad_key" })).toThrow(/secretKey/);
  });

  it("throws if publicKey looks like a secret key", () => {
    const botcha = createBotcha(config);
    expect(() => botcha.middleware({ publicKey: "sk_live_oops" })).toThrow(
      /publicKey must be a public key/
    );
  });
});
