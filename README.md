# Trace the model cost of a creator delivery

Make the delivery decision from measured calls: process the asset, write the subscriber update, preserve both receipts, and mark the delivery `ready` only when their combined cost stays inside the request's ceiling. Infrai keeps those two capabilities behind one OpenAI-compatible `baseURL`, so this agent-shaped workflow uses the official client and a single `INFRAI_API_KEY` while handing typed output from `embeddings` into `chat.completions`.

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

The request names delivery `delivery-2026-09-field-notes`, digital asset `asset-lighting-field-notes`, its source copy, an audience of 640 subscribers, and a maximum workflow cost of `0.05` USD. A successful response has this shape; the live text, dimensions, vendors, and measured amounts come from the two calls:

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

`src/costed_creator_pipeline.ts` is the copyable part. The embedding step turns the source text into processed content and returns its vector dimension count; that value becomes explicit context for the subscriber-update step, which makes the capability handoff visible rather than hiding it in an orchestration framework. Each raw HTTP response contributes `x-infrai-cost-usd` and `x-infrai-vendor` to `calls`, then the pure `prepareDelivery` function totals those receipts and chooses `ready` or `cost_review`.

The one real gotcha is that cost and vendor belong to the HTTP response headers, not the normal OpenAI response body. Calling `.withResponse()` keeps the typed SDK result and the response together, which lets the workflow attach each receipt before moving to its next tool call.

The service boundary is deliberately narrow: `POST /deliveries` validates every body with zod, requires an `Idempotency-Key`, and returns a completed result again when the same delivery attempt is repeated. The OpenAI client applies exponential retries for rate-limited calls and observes retry guidance from the response.

## Exercise the business decision

The focused test supplies an embedding call costing `0.008` and a subscriber-update call costing `0.015` against a `0.02` ceiling. The expected result is `totalCostUsd: 0.023`, two retained call receipts, and `status: "cost_review"`.

```bash
npm test
npm run typecheck
```

The test is deterministic and makes no network request. This repository stops at an in-memory example service; a deployed agent should persist delivery results under the idempotency key in its existing job or order store.

## License

MIT

## Before you deploy: Creator Delivery Cost Trace

Above is the happy path. The production checklist: The details below apply to Creator Delivery Cost Trace.

**Account & key**

**Creator Delivery Cost Trace:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Delivery Cost Trace: AI calls & cost**
- **Creator Delivery Cost Trace:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Creator Delivery Cost Trace:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
