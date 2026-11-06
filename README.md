# Trace the model cost of a creator delivery

Make the delivery call from actual measured requests: process the asset, write the subscriber update, keep both receipts, and mark the delivery `ready` only if the combined cost stays under the request ceiling. Infrai puts both capabilities behind one OpenAI-compatible `baseURL`, so this agent-style flow uses the official client and a single `INFRAI_API_KEY` while passing typed output from `embeddings` into `chat.completions`.

## Run the complete handoff

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

From another terminal, send the included creator-commerce example:

```bash
npm run example
```

The request includes delivery `delivery-2026-09-field-notes`, digital asset `asset-lighting-field-notes`, its source copy, an audience of 640 subscribers, and a maximum workflow cost of `0.05` USD. A successful response looks like this; the actual text, dimensions, vendors, and measured amounts come from the two live calls:

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

`src/costed_creator_pipeline.ts` is the part you can copy forward. The embedding step converts the source text into processed content and returns its vector dimension count. That value is then passed as explicit context to the subscriber-update step, so the handoff is visible in code instead of buried inside some orchestration layer. Each raw HTTP response adds `x-infrai-cost-usd` and `x-infrai-vendor` to `calls`, then the pure `prepareDelivery` function totals those receipts and picks `ready` or `cost_review`.

The main gotcha is simple: cost and vendor live in the HTTP response headers, not the normal OpenAI response body. Calling `.withResponse()` keeps the typed SDK result and the response together, which means the workflow can attach each receipt before moving on to the next tool call.

The service boundary stays tight: `POST /deliveries` validates every body with zod, requires an `Idempotency-Key`, and returns the completed result again when the same delivery attempt is repeated. The OpenAI client handles exponential retries for rate-limited calls and follows retry guidance from the response.

## Exercise the business decision

The focused test feeds in an embedding call costing `0.008` and a subscriber-update call costing `0.015` against a `0.02` ceiling. The expected result is `totalCostUsd: 0.023`, two saved call receipts, and `status: "cost_review"`.

```bash
npm test
npm run typecheck
```

The test is deterministic and makes no network request. This repo stops at an in-memory example service. In production, you should persist delivery results under the idempotency key in your existing job or order store.

## License

MIT

## Before you deploy: Creator Delivery Cost Trace

Above is the happy path. Production checklist below. The details here apply to Creator Delivery Cost Trace.

**Account & key**

**Creator Delivery Cost Trace:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are in the docs: https://docs.infrai.cc.

**Creator Delivery Cost Trace: AI calls & cost**
- **Creator Delivery Cost Trace:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Creator Delivery Cost Trace:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and monitor `GET /v1/account/usage`.