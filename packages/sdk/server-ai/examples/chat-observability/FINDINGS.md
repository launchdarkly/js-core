# Chat Observability Example -- Debugging Findings

Temporary notes capturing what we learned getting OpenLLMetry (LLM span tagging)
working with the LaunchDarkly AI SDK's `createChat` flow.

## Goal

Tag LLM spans (model, tokens, prompts) via OpenLLMetry so they appear in the
LaunchDarkly Observability dashboard alongside the SDK's own telemetry.

## Issues Discovered

### 1. openai v6 is not supported by OpenLLMetry

`@traceloop/instrumentation-openai` declares supported versions `>=4 <6`.
The provider package (`@launchdarkly/server-sdk-ai-openai`) had `openai: "^6.0.0"`
in its devDependencies, which caused Yarn to resolve v6 for the provider even when
the example pinned v5.

**Fix:** Pin `openai` to `^5.x` in the example's dependencies (and `resolutions`
to force a single copy in the monorepo).

### 2. Dual openai module instances in the monorepo

Yarn workspaces resolved two separate copies of `openai`:
- Example: `chat-observability/node_modules/openai/` (v5)
- Provider: `server-ai-openai/node_modules/openai/` (v6)

OpenLLMetry patched the example's copy; the provider used its own unpatched copy.

**Fix:** Add `"resolutions": { "openai": "^5.12.2" }` in the example's
`package.json` (and/or the root `package.json`) to collapse to a single copy.

### 3. ESM / CJS module boundary (root cause)

This is the core issue and a [known OpenLLMetry limitation](https://github.com/traceloop/openllmetry-js/issues/406).

**How it happens:**
- The example compiles to CommonJS (`"module": "CommonJS"` in tsconfig).
- `init.ts` calls `registerInstrumentations()` + `require('openai')`.
  OpenLLMetry hooks into `require()` and patches the CJS copy of openai
  (`openai/index.js` → `openai/client.js`).
- The AI SDK's `AIProviderFactory` loads the provider via a **real** `await import()`,
  which Node.js always resolves through the ESM loader.
- The provider package has `"type": "module"`, so `await import()` loads
  `dist/index.js` (ESM), which does `import { OpenAI } from "openai"`.
- Node's ESM loader resolves `openai` to `openai/index.mjs` → `openai/client.mjs`,
  a **completely separate class tree** from the CJS entry. This ESM copy is never
  patched by OpenLLMetry.

**Why `--import @opentelemetry/instrumentation/hook.mjs` didn't help:**
The ESM loader hook (`import-in-the-middle`) should theoretically intercept ESM
imports, but in practice it did not patch the provider's openai imports. This may
be a limitation of how `import-in-the-middle` interacts with dynamically imported
packages that themselves have static ESM imports.

**Why `await import('openai')` in the example didn't help:**
TypeScript's CommonJS output transpiles `await import('openai')` into
`Promise.resolve().then(() => __importStar(require('openai')))`, which still uses
`require()` and returns the CJS module. The ESM module was never loaded.

### 4. The working fix: manual ESM patch via `new Function`

```typescript
// Prevents TypeScript from transpiling import() to require()
const dynamicImport = new Function('specifier', 'return import(specifier)');
const esmOpenai = await dynamicImport('openai');
(openaiInstrumentation as any).patch(esmOpenai);
```

This loads the real ESM module (`openai/index.mjs`) and manually applies the
OpenLLMetry instrumentation's `patch()` method to the ESM class prototypes
(`OpenAI.Chat.Completions.prototype.create`, etc.). Since ESM modules are cached,
the patched prototypes are shared with the provider when it later imports openai.

### 5. Initialization order matters

`registerInstrumentations()` must run AFTER the LD SDK `init()` with the
Observability plugin. The Observability plugin sets up the global
TracerProvider; if `registerInstrumentations()` runs first, the instrumentation
connects to a no-op provider and spans are silently discarded.

## Final Architecture (single file)

```
index.ts
  ├── dotenv/config
  ├── new OpenAIInstrumentation()
  ├── init(sdkKey, { plugins: [Observability] })          ← sets up TracerProvider
  ├── registerInstrumentations([openaiInstrumentation])   ← MUST be after init()
  │
  └── main()
      ├── new Function(...)('openai')                     ← real ESM import
      ├── openaiInstrumentation.patch(esmOpenai)           ← patches ESM openai
      └── createChat / chat.invoke                         ← now traced
```

## Key Constraints

- **CommonJS required:** The example must compile to CJS so module-level code
  executes synchronously in declaration order.
- **openai < 6 required:** OpenLLMetry does not support v6 (`>=4 <6`).
- **Single openai copy required:** In a monorepo, `resolutions` may be needed to
  prevent Yarn from installing separate copies for workspace packages.
- **Manual ESM patch required:** Until OpenLLMetry supports ESM natively, the
  `new Function` + `.patch()` workaround is needed for any code path that loads
  openai through ESM (including the AI SDK's dynamic provider loading).
- **LD init() before registerInstrumentations():** The Observability plugin sets
  up the TracerProvider; instrumentations must be registered after it exists.
- **`require('openai')` is not needed** if only the ESM path is used (via the
  manual patch). The CJS force-load was only necessary when relying on
  auto-instrumentation for direct `require('openai')` usage.
- **`--import @opentelemetry/instrumentation/hook.mjs` is not needed.** The ESM
  loader hook did not help; the manual patch is what works.
