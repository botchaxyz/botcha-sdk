# @botcha/sdk

BOTCHA verification SDK for platforms. Read-only mirror of [botchaxyz/botcha](https://github.com/botchaxyz/botcha).

## Install

```bash
npm install @botcha/sdk
```

## Usage

```typescript
import { createBotcha } from "@botcha/sdk";

const botcha = createBotcha({ secretKey: "sk_live_xxx" });

// Express middleware
app.use("/protected", botcha.middleware());

// Or verify manually
const result = await botcha.verify(receipt);
```

## Documentation

See [botcha.xyz](https://botcha.xyz) for full documentation.

## License

MIT
