import assert from "node:assert/strict";
import test from "node:test";
import { prepareDelivery, type CreatorModels, type DeliveryInput } from "../src/costed_creator_pipeline.js";

test("sends an over-limit two-call delivery to cost review", async () => {
  const input: DeliveryInput = {
    deliveryId: "delivery-test-7",
    assetId: "asset-test-7",
    assetName: "Studio Lighting Notes",
    sourceText: "A concise lighting guide.",
    subscriberCount: 25,
    maxWorkflowCostUsd: 0.02,
  };
  const models: CreatorModels = {
    async embedContent() {
      return {
        value: 1536,
        receipt: { step: "content-embedding", costUsd: 0.008, vendor: "provider-a" },
      };
    },
    async writeSubscriberUpdate(_input, dimensions) {
      assert.equal(dimensions, 1536);
      return {
        value: "Your new lighting notes are ready.",
        receipt: { step: "subscriber-update", costUsd: 0.015, vendor: "provider-b" },
      };
    },
  };

  const result = await prepareDelivery(input, models);

  assert.equal(result.totalCostUsd, 0.023);
  assert.equal(result.status, "cost_review");
  assert.deepEqual(result.calls.map((call) => call.step), ["content-embedding", "subscriber-update"]);
});
