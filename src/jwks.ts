import { createRemoteJWKSet } from "jose";

const JWKS_CACHE_TTL = 3600_000; // 1 hour

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedAt = 0;
let cachedUrl = "";

export function getJWKS(apiBase: string): ReturnType<typeof createRemoteJWKSet> {
  const url = `${apiBase}/.well-known/jwks.json`;
  const now = Date.now();

  if (cachedJWKS && cachedUrl === url && now - cachedAt < JWKS_CACHE_TTL) {
    return cachedJWKS;
  }

  cachedJWKS = createRemoteJWKSet(new URL(url));
  cachedAt = now;
  cachedUrl = url;
  return cachedJWKS;
}
