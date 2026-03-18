import { describe, it, expect } from "vitest";

import { createBotcha, getBotchaContext, CONTEXT_HEADER, RECEIPT_HEADER, botcha403 } from "../src/next";

describe("Next.js re-exports from web adapter", () => {
  it("exports createBotcha as a function", () => {
    expect(typeof createBotcha).toBe("function");
  });

  it("exports RECEIPT_HEADER constant", () => {
    expect(RECEIPT_HEADER).toBe("x-botcha-receipt");
  });

  it("exports botcha403 function", () => {
    expect(typeof botcha403).toBe("function");
  });

  it("exports CONTEXT_HEADER constant", () => {
    expect(CONTEXT_HEADER).toBe("x-botcha-context");
  });
});

describe("getBotchaContext()", () => {
  function makeRequest(headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/test", { headers });
  }

  it("parses valid context header into VerifyResult", () => {
    const context = {
      valid: true,
      challengeId: "ch-1",
      projectId: "proj-1",
      issuedAt: 1000,
      expiresAt: 2000,
      fresh: true,
    };

    const result = getBotchaContext(
      makeRequest({ [CONTEXT_HEADER]: JSON.stringify(context) })
    );

    expect(result).toEqual(context);
  });

  it("returns null when header is missing", () => {
    const result = getBotchaContext(makeRequest());
    expect(result).toBeNull();
  });

  it("returns null when header is malformed JSON", () => {
    const result = getBotchaContext(
      makeRequest({ [CONTEXT_HEADER]: "not-json{" })
    );
    expect(result).toBeNull();
  });

  it("returns null when header JSON has valid=false", () => {
    const result = getBotchaContext(
      makeRequest({ [CONTEXT_HEADER]: JSON.stringify({ valid: false, reason: "EXPIRED" }) })
    );
    expect(result).toBeNull();
  });

  it("returns null when header JSON is missing challengeId", () => {
    const result = getBotchaContext(
      makeRequest({ [CONTEXT_HEADER]: JSON.stringify({ valid: true }) })
    );
    expect(result).toBeNull();
  });

  it("returns null when header is 'null'", () => {
    const result = getBotchaContext(
      makeRequest({ [CONTEXT_HEADER]: "null" })
    );
    expect(result).toBeNull();
  });
});
