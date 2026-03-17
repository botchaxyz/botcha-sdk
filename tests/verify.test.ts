import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyReceipt } from "../src/verify";

// Mock jose
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn().mockReturnValue("mock-jwks"),
  errors: {
    JWTExpired: class JWTExpired extends Error { name = "JWTExpired" },
    JWSSignatureVerificationFailed: class JWSFailed extends Error { name = "JWSFailed" },
    JWSInvalid: class JWSInvalid extends Error { name = "JWSInvalid" },
  },
}));

// Mock fetch for API fallback
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { jwtVerify, errors } from "jose";

const config = {
  secretKey: "sk_live_test",
  projectId: "proj-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyReceipt", () => {
  describe("input validation", () => {
    it("rejects empty string", async () => {
      const result = await verifyReceipt("", config);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("INVALID_RECEIPT");
    });

    it("rejects oversized receipt", async () => {
      const result = await verifyReceipt("x".repeat(10_001), config);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("INVALID_RECEIPT");
    });
  });

  describe("local JWKS verification", () => {
    it("returns valid for a good receipt", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          challengeId: "ch-1",
          aud: "proj-1",
          iat: now - 30,
          exp: now + 570,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      const result = await verifyReceipt("valid.jwt", config);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.challengeId).toBe("ch-1");
        expect(result.projectId).toBe("proj-1");
        expect(result.fresh).toBe(true);
      }
    });

    it("returns expired for an expired receipt", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          challengeId: "ch-1",
          aud: "proj-1",
          iat: now - 700,
          exp: now - 100,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      const result = await verifyReceipt("expired.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("RECEIPT_EXPIRED");
    });

    it("rejects when aud doesn't match projectId", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          challengeId: "ch-1",
          aud: "different-project",
          iat: now - 30,
          exp: now + 570,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      const result = await verifyReceipt("wrong-project.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("PROJECT_MISMATCH");
    });

    it("rejects bad signature", async () => {
      vi.mocked(jwtVerify).mockRejectedValue(
        new errors.JWSSignatureVerificationFailed()
      );

      const result = await verifyReceipt("bad-sig.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("INVALID_RECEIPT");
    });

    it("returns not fresh when receipt is old", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          challengeId: "ch-1",
          aud: "proj-1",
          iat: now - 601,
          exp: now + 100,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      const result = await verifyReceipt("stale.jwt", config);

      expect(result.valid).toBe(true);
      if (result.valid) expect(result.fresh).toBe(false);
    });

    it("rejects receipt with missing challengeId claim", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          aud: "proj-1",
          iat: now - 30,
          exp: now + 570,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      const result = await verifyReceipt("no-challenge-id.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("MALFORMED_RECEIPT");
    });
  });

  describe("API fallback", () => {
    it("falls back to API when JWKS throws unknown error", async () => {
      vi.mocked(jwtVerify).mockRejectedValue(new Error("network error"));

      const now = Math.floor(Date.now() / 1000);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          valid: true,
          challengeId: "ch-1",
          projectId: "proj-1",
          issuedAt: now - 30,
          expiresAt: now + 570,
          fresh: true,
        }),
      });

      const result = await verifyReceipt("fallback.jwt", config);

      expect(result.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.botcha.xyz/v1/validate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_test",
          }),
        })
      );
    });

    it("falls back to API when projectId not configured", async () => {
      const now = Math.floor(Date.now() / 1000);
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          challengeId: "ch-1",
          aud: "proj-1",
          iat: now - 30,
          exp: now + 570,
          iss: "botcha.xyz",
        },
        protectedHeader: { alg: "ES256" },
      } as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          valid: true, challengeId: "ch-1", projectId: "proj-1",
          issuedAt: now - 30, expiresAt: now + 570, fresh: true,
        }),
      });

      const configNoProject = { secretKey: "sk_live_test" };
      const result = await verifyReceipt("no-project.jwt", configNoProject);

      expect(result.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("returns error when API says invalid", async () => {
      vi.mocked(jwtVerify).mockRejectedValue(new Error("network error"));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          valid: false,
          reason: "RECEIPT_EXPIRED",
        }),
      });

      const result = await verifyReceipt("api-invalid.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("RECEIPT_EXPIRED");
    });

    it("returns malformed when API response missing fields", async () => {
      vi.mocked(jwtVerify).mockRejectedValue(new Error("network error"));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true }),
      });

      const result = await verifyReceipt("bad-api.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("MALFORMED_RECEIPT");
    });

    it("returns service unavailable when API is down", async () => {
      vi.mocked(jwtVerify).mockRejectedValue(new Error("network error"));
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const result = await verifyReceipt("api-down.jwt", config);

      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("VALIDATION_SERVICE_UNAVAILABLE");
    });
  });
});
