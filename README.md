# @botcha/sdk

BOTCHA verification SDK for platforms. Gate your API endpoints behind agent reasoning verification.

## Install

```bash
npm install @botcha/sdk
```

## Quick Start

### Express

```typescript
import { createBotcha } from "@botcha/sdk";

const botcha = createBotcha({
  secretKey: "sk_live_xxx",
  projectId: "your-project-id",
});

app.use("/api/action", botcha.middleware({ publicKey: "pk_live_xxx" }));
```

### Hono

```typescript
import { createBotcha } from "@botcha/sdk/hono";

const botcha = createBotcha({
  secretKey: "sk_live_xxx",
  projectId: "your-project-id",
});

app.use("/api/action", botcha.middleware({ publicKey: "pk_live_xxx" }));

// Access verification result in route handlers
app.post("/api/action", (c) => {
  const botcha = c.get("botcha"); // { valid, challengeId, projectId, fresh }
});
```

### Next.js (App Router)

**Route Handler** — verify receipts directly in API routes:

```typescript
import { createBotcha } from "@botcha/sdk/next";

const botcha = createBotcha({
  secretKey: process.env.BOTCHA_SECRET_KEY!,
  projectId: "your-project-id",
});

export async function POST(request: Request) {
  const result = await botcha.protect(request, { publicKey: "pk_live_xxx" });
  if (result instanceof Response) return result; // 403 or 500
  // result.challengeId, result.projectId, result.fresh
}
```

**Edge Middleware** — protect all routes matching a pattern:

```typescript
// middleware.ts
import { createBotcha, CONTEXT_HEADER } from "@botcha/sdk/next";
import { NextResponse } from "next/server";

const botcha = createBotcha({ secretKey: process.env.BOTCHA_SECRET_KEY! });

export async function middleware(request: Request) {
  const result = await botcha.protect(request, { publicKey: "pk_live_xxx" });
  if (result instanceof Response) return result;
  // Forward context to route handlers
  const headers = new Headers(request.headers);
  headers.set(CONTEXT_HEADER, JSON.stringify(result));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/api/protected/:path*"] };
```

Then in your route handler, read the forwarded context:

```typescript
import { getBotchaContext } from "@botcha/sdk/next";

export async function POST(request: Request) {
  const botcha = getBotchaContext(request);
  if (!botcha) return Response.json({ error: "unauthorized" }, { status: 403 });
  // botcha.challengeId, botcha.projectId, botcha.fresh
}
```

> **Security:** `getBotchaContext()` trusts the `x-botcha-context` header. Only use it in routes protected by the BOTCHA middleware — otherwise an attacker could forge the header.

### Web API (SvelteKit, Remix, Deno, etc.)

The generic Web API adapter works with any framework that uses standard `Request`/`Response`:

```typescript
import { createBotcha } from "@botcha/sdk/web";

const botcha = createBotcha({ secretKey: "sk_live_xxx" });

export async function POST({ request }) {
  const result = await botcha.protect(request, { publicKey: "pk_live_xxx" });
  if (result instanceof Response) return result;
  // result.challengeId, result.projectId, result.fresh
}
```

### Direct Verification

```typescript
import { createBotcha } from "@botcha/sdk";

const botcha = createBotcha({ secretKey: "sk_live_xxx" });
const result = await botcha.verify(receipt);

if (result.valid) {
  // result.challengeId, result.projectId, result.fresh
} else {
  // result.reason
}
```

## How It Works

1. Agent hits your endpoint without a receipt -- gets a 403 with instructions
2. Agent follows the instructions to get a receipt from BOTCHA
3. Agent retries with `X-Botcha-Receipt` header -- request proceeds

Replay protection is automatic: each receipt can only be validated once.

## 403 Response

When verification fails, the middleware returns a structured 403:

```json
{
  "error": "BOTCHA_REQUIRED",
  "message": "Access denied — this endpoint requires BOTCHA agency verification. Read https://api.botcha.xyz/skill.md for instructions.",
  "reason": "MISSING_RECEIPT",
  "public_key": "pk_live_xxx",
  "receipt_header": "x-botcha-receipt",
  "skill_url": "https://api.botcha.xyz/skill.md"
}
```

The `message` points agents to `skill.md` (the single source of truth for authentication instructions). The structured fields (`public_key`, `receipt_header`) provide everything agents need programmatically.

Possible reasons: `MISSING_RECEIPT`, `INVALID_RECEIPT`, `RECEIPT_EXPIRED`, `MISSING_AUDIENCE`, `PROJECT_MISMATCH`, `MALFORMED_RECEIPT`, `RECEIPT_ALREADY_USED`, `VALIDATION_SERVICE_UNAVAILABLE`.

## License

MIT
