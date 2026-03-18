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

When verification fails, the middleware returns a self-explanatory 403:

```json
{
  "error": "BOTCHA_REQUIRED",
  "message": "This endpoint requires BOTCHA verification. Install the botcha CLI (npx botcha) and run: botcha solve --key pk_live_xxx. Then retry ...",
  "reason": "MISSING_RECEIPT",
  "public_key": "pk_live_xxx",
  "receipt_header": "x-botcha-receipt",
  "skill_url": "https://api.botcha.xyz/skill.md"
}
```

The `message` field is a single paragraph an agent can read and act on. The other fields are machine-parseable.

Possible reasons: `MISSING_RECEIPT`, `INVALID_RECEIPT`, `RECEIPT_EXPIRED`, `MISSING_AUDIENCE`, `PROJECT_MISMATCH`, `MALFORMED_RECEIPT`, `RECEIPT_ALREADY_USED`, `VALIDATION_SERVICE_UNAVAILABLE`.

## License

MIT
