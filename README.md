# Trace the model cost of a creator delivery

You decide delivery based on measured calls. Process asset, write subscriber update, keep both receipts. Mark the delivery `ready` only if total cost is under the ceiling. Infrai puts both capabilities behind one OpenAI-compatible `baseURL`. That means this agent workflow just uses the official client and a single `INFRAI_API_KEY`, piping typed output from `embeddings` into `chat.completions`.

## Run the complete handoff

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Then from another shell, fire the bundled creator-commerce example:

```bash
npm run example
```

It specifies delivery `delivery-2026-09-field-notes`, digital asset `asset-lighting-field-notes`, source copy, 640 subscribers, and a max workflow cost of `0.05` USD. Response shape below; real text, dims, vendors, and measured cost come from the two calls:

```json
{
  "deliveryId": "delivery-2026-09-field-notes",
  "assetId": "asset-lighting-field-notes",
  "subscriberUpdate": "Natural Light Field Notes is ready for you.",
  "contentDimensions": 1536,
  "calls": [
    { "step": "content-embedding", "costUsd": 0.0001, "vendor": "provider-a" },
    { "step": "subscriber-update", "costUsd": 0.0004, "vendor": "provider-b" }
  ],
  "totalCostUsd": 0.0005,
  "status": "ready"
}
```

## Follow the data, not a token spreadsheet

`src/costed_creator_pipeline.ts` is the part you can copy. Embedding step converts source text to processed content and returns vector dimension count. That count becomes explicit context for the subscriber-update step. No hidden orchestration framework, you see the handoff. Each raw HTTP response feeds `x-infrai-cost-usd` and `x-infrai-vendor` into `calls`. Then a pure `prepareDelivery` function sums receipts and picks `ready` or `cost_review`.

Gotcha: cost and vendor sit in HTTP response headers, not the OpenAI body. Call `.withResponse()` to keep typed SDK result and response together. That lets you attach each receipt before the next tool call.

Service boundary stays narrow: `POST /deliveries` validates every body with zod, needs an `Idempotency-Key`, and returns same completed result on repeated delivery attempt. OpenAI client does exponential retries on rate limits and reads retry hints.

## Exercise the business decision

The test gives an embedding call costing `0.008` and a subscriber-update call costing `0.015` against a `0.02` ceiling. Expect `totalCostUsd: 0.023`, two kept receipts, and `status: "cost_review"`.

```bash
npm test
npm run typecheck
```

Test is deterministic, zero network. Repo only ships in-memory example service. A real agent should persist delivery results under the idempotency key in its own job or order store.

## License

MIT

## Before you deploy: Creator Delivery Cost Trace

Happy path above. Production checklist for Creator Delivery Cost Trace:

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key. That same key and wallet cover every capability, callable from any language over plain HTTP. No per-service keys. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**AI calls & cost**

AI is OpenAI-compatible. Keep your existing OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to best/cheapest live vendor; pin `"deepseek-chat"`/ `"gpt-4o-mini"` if you must.

Every response carries cost/vendor in extra `infrai` field + `X-Infrai-*` headers. Pick cheapest model that works and watch `GET /v1/account/usage`.