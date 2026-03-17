import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock verify module
vi.mock("../src/verify", () => ({
  verifyReceipt: vi.fn(),
}));

import { createBotcha } from "../src/index";
import { verifyReceipt } from "../src/verify";

const config = { secretKey: "sk_live_test", projectId: "proj-1" };
const pk = "pk_live_test";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Express middleware", () => {
  function makeReq(headers: Record<string, string> = {}) {
    return { headers, botcha: undefined as any };
  }

  function makeRes() {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    return { status, json };
  }

  it("returns 403 with full botcha403 shape when receipt header is missing", async () => {
    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk });
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "BOTCHA_REQUIRED",
        reason: "MISSING_RECEIPT",
        public_key: pk,
        receipt_header: "x-botcha-receipt",
        skill_url: "https://api.botcha.xyz/skill.md",
      })
    );
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain(pk);
    expect(body.message).toContain("skill.md");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 with full botcha403 shape when receipt is invalid", async () => {
    vi.mocked(verifyReceipt).mockResolvedValue({ valid: false, reason: "INVALID_RECEIPT" });

    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk });
    const req = makeReq({ "x-botcha-receipt": "bad.jwt" });
    const res = makeRes();
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "BOTCHA_REQUIRED",
        reason: "INVALID_RECEIPT",
        public_key: pk,
        skill_url: "https://api.botcha.xyz/skill.md",
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and attaches result when receipt is valid", async () => {
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
    const req = makeReq({ "x-botcha-receipt": "good.jwt" });
    const res = makeRes();
    const next = vi.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.botcha).toEqual(verifyResult);
  });

  it("uses custom header when configured", async () => {
    const botcha = createBotcha(config);
    const mw = botcha.middleware({ publicKey: pk, header: "x-custom" });
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ receipt_header: "x-custom" })
    );
  });
});

describe("createBotcha validation", () => {
  it("throws if secretKey doesn't start with sk_", () => {
    expect(() => createBotcha({ secretKey: "bad_key" })).toThrow(/secretKey/);
  });

  it("throws if secretKey is empty", () => {
    expect(() => createBotcha({ secretKey: "" })).toThrow(/secretKey/);
  });

  it("throws if publicKey looks like a secret key", () => {
    const botcha = createBotcha(config);
    expect(() => botcha.middleware({ publicKey: "sk_live_oops" })).toThrow(
      /publicKey must be a public key/
    );
  });
});
