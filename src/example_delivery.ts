async function main(): Promise<void> {
  const response = await fetch("http://localhost:3000/deliveries", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "delivery-field-notes-v3",
    },
    body: JSON.stringify({
      deliveryId: "delivery-2026-09-field-notes",
      assetId: "asset-lighting-field-notes",
      assetName: "Natural Light Field Notes",
      sourceText: "A twelve-page guide to window placement, reflectors, and consistent product photographs.",
      subscriberCount: 640,
      maxWorkflowCostUsd: 0.05,
    }),
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

void main();
