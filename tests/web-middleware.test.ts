import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock verify module
vi.mock("../src/verify", () => ({
  verifyReceipt: vi.fn(),
}));

import { createBotcha } from "../src/web";
import { verifyReceipt } from "../src/verify";

const config = { secretKey: "sk_live_test", projectId: "proj-1" };
const pk = "pk_live_test";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", { headers });
}

describe("Web API protect()", () => {
  it("returns 403 with full botcha403 shape when receipt header is missing", async () => {
    const botcha = createBotcha(config);
    const response = await botcha.protect(makeRequest(), { publicKey: pk });

    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).json();
    expect((response as Response).status).toBe(403);
    expect(body).toMatchObject({
      error: "BOTCHA_REQUIRED",
      reason: "MISSING_RECEIPT",
      public_key: pk,
      receipt_header: "x-botcha-receipt",
      skill_url: "https://api.botcha.xyz/skill.md",
    });
    expect(body.message).toContain(pk);
    expect(body.message).toContain("skill.md");
  });

  it("returns 403 with full botcha403 shape when receipt is invalid", async () => {
    vi.mocked(verifyReceipt).mockResolvedValue({ valid: false, reason: "INVALID_RECEIPT" });

    const botcha = createBotcha(config);
    const response = await botcha.protect(
      makeRequest({ "x-botcha-receipt": "bad.jwt" }),
      { publicKey: pk }
    );

    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).json();
    expect((response as Response).status).toBe(403);
    expect(body).toMatchObject({
      error: "BOTCHA_REQUIRED",
      reason: "INVALID_RECEIPT",
      public_key: pk,
      skill_url: "https://api.botcha.xyz/skill.md",
    });
  });

  it("returns VerifyResult when receipt is valid", async () => {
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
    const result = await botcha.protect(
      makeRequest({ "x-botcha-receipt": "good.jwt" }),
      { publicKey: pk }
    );

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual(verifyResult);
  });

  it("uses custom header when configured", async () => {
    const botcha = createBotcha(config);
    const response = await botcha.protect(
      makeRequest(),
      { publicKey: pk, header: "x-custom" }
    );

    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).json();
    expect(body).toMatchObject({ receipt_header: "x-custom" });
  });

  it("returns 500 when verifyReceipt throws unexpectedly", async () => {
    vi.mocked(verifyReceipt).mockRejectedValue(new Error("unexpected jose error"));

    const botcha = createBotcha(config);
    const response = await botcha.protect(
      makeRequest({ "x-botcha-receipt": "some.jwt" }),
      { publicKey: pk }
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(500);
    const body = await (response as Response).json();
    expect(body).toMatchObject({
      error: "BOTCHA_UNAVAILABLE",
      message: "Verification service error",
    });
  });
});

describe("createBotcha validation", () => {
  it("throws if secretKey doesn't start with sk_", () => {
    expect(() => createBotcha({ secretKey: "bad_key" })).toThrow(/secretKey/);
  });

  it("throws if secretKey is empty", () => {
    expect(() => createBotcha({ secretKey: "" })).toThrow(/secretKey/);
  });

  it("throws if publicKey looks like a secret key", async () => {
    const botcha = createBotcha(config);
    await expect(
      botcha.protect(makeRequest(), { publicKey: "sk_live_oops" })
    ).rejects.toThrow(/publicKey must be a public key/);
  });
});
